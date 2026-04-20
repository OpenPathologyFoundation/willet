// Whisper prompt builder — biases transcription toward pathology vocabulary
// by passing OpenAI Whisper's optional `prompt` parameter. The prompt is a
// soft bias, not a dictionary; it nudges Whisper toward our preferred forms
// (Gleason, perineural, HGPIN, Hurthle, Napsin A) so fewer corrections are
// needed downstream by transcription-correction.ts.
//
// Sources, in order of weight (last = strongest Whisper bias):
//   1. Shared general hints          — pathology-vocabulary.json → whisperHints
//   2. Shared organ-specific hints   — pathology-vocabulary.json → organHints[organ]
//   3. Personal cross-organ terms    — personalEntries with organKey null or "_all"
//   4. Personal organ-specific terms — personalEntries with matching organKey
//
// Truncation is from the front, so the pathologist's own vocabulary survives
// a length-cap overflow.

import vocabulary from '../../../mcp-server/data/pathology-vocabulary.json';

// Whisper's `prompt` parameter is limited to 224 tokens. A conservative
// English char budget keeps us safely under the cap without tokenizing.
const MAX_PROMPT_CHARS = 800;

const PREAMBLE = 'Anatomic pathology dictation. Preferred vocabulary:';

const ALL_BUCKET = '_all';

interface Vocabulary {
  confusionPairs: Record<string, Record<string, string>>;
  whisperHints: string[];
  organHints?: Record<string, string[]>;
}

/**
 * A personal-vocabulary entry. `organKey` of null/undefined or "_all" means
 * "applies to every specimen"; any other string matches the resolved organ
 * key for the current specimen.
 */
export interface PersonalVocabEntry {
  term: string;
  organKey?: string | null;
}

const vocab = vocabulary as Vocabulary;

type CacheKey = string;

const promptCache = new Map<CacheKey, string>();

/**
 * Resolve a free-text specimen description to an organ key that exists in
 * the vocabulary. Mirrors the logic in transcription-correction.ts so the
 * prompt and the post-correction use the same organ bucket.
 */
function resolveOrganKey(specimenType: string | null): string | null {
  if (!specimenType) return null;
  const lower = specimenType.toLowerCase();
  const keys = new Set([
    ...Object.keys(vocab.confusionPairs),
    ...Object.keys(vocab.organHints ?? {}),
  ]);
  for (const key of keys) {
    if (key !== '_default' && key !== ALL_BUCKET && lower.includes(key)) return key;
  }
  // Extended mappings — upper GI / appendix / rectum all use the "colon" bucket.
  const extended: Record<string, string> = {
    gastri: 'colon', stomach: 'colon', esophag: 'colon', duoden: 'colon',
    rectal: 'colon', rectum: 'colon', cecum: 'colon', sigmoid: 'colon', appendix: 'colon',
    thoracic: 'lung', pulmonary: 'lung',
    cervix: 'gyn', cervical: 'gyn', endometrial: 'gyn', ovary: 'gyn', ovarian: 'gyn', uterus: 'gyn', uterine: 'gyn',
    dermal: 'skin', melanoma: 'skin',
  };
  for (const [fragment, key] of Object.entries(extended)) {
    if (lower.includes(fragment)) return key;
  }
  return null;
}

/**
 * Canonical term list for an organ: prefer curated `organHints` when defined,
 * otherwise fall back to the right-hand values of the organ's confusion pairs.
 */
function sharedOrganTerms(organKey: string): string[] {
  const curated = vocab.organHints?.[organKey];
  if (curated && curated.length > 0) return curated;
  const pairs = vocab.confusionPairs[organKey];
  if (!pairs) return [];
  return Array.from(new Set(Object.values(pairs)));
}

/**
 * Does a personal entry apply to the current organ?
 *   - organKey undefined or null → applies everywhere
 *   - organKey === "_all"        → applies everywhere
 *   - organKey === currentOrgan  → applies here
 *   - otherwise                  → filtered out
 */
function personalAppliesTo(entry: PersonalVocabEntry, currentOrgan: string | null): boolean {
  if (!entry.organKey || entry.organKey === ALL_BUCKET) return true;
  return entry.organKey === currentOrgan;
}

/**
 * Stable fingerprint for a personal entry list. Two array references with
 * the same content produce the same fingerprint and hit the cache.
 */
function fingerprint(entries?: ReadonlyArray<PersonalVocabEntry>): string {
  if (!entries || entries.length === 0) return '';
  return entries.map((e) => `${e.organKey ?? ''}:${e.term}`).join('|');
}

/**
 * Build a Whisper prompt string from general hints + specimen-specific
 * shared hints + personal entries filtered by organ. Memoized by
 * (organKey, personalFingerprint) so a recording-per-case workflow rebuilds
 * the prompt at most once per dictionary change.
 *
 * Backwards-compatible with `personalTerms: string[]` — a flat string[] is
 * coerced to cross-organ entries (organKey = null).
 */
export function buildWhisperPrompt(
  specimenType: string | null,
  personalEntries?: ReadonlyArray<PersonalVocabEntry | string>,
): string {
  const organKey = resolveOrganKey(specimenType);
  const structured: PersonalVocabEntry[] = (personalEntries ?? []).map((e) =>
    typeof e === 'string' ? { term: e, organKey: null } : e,
  );
  const key: CacheKey = `${organKey ?? '_none'}::${fingerprint(structured)}`;

  const cached = promptCache.get(key);
  if (cached !== undefined) return cached;

  const general = vocab.whisperHints;
  const organSpecific = organKey ? sharedOrganTerms(organKey) : [];
  const personalCross = structured
    .filter((e) => !e.organKey || e.organKey === ALL_BUCKET)
    .map((e) => e.term);
  const personalOrgan = structured
    .filter((e) => e.organKey && e.organKey !== ALL_BUCKET && e.organKey === organKey)
    .map((e) => e.term);

  // Deduplicate across sources while preserving priority order.
  // Order: general → shared organ → personal cross-organ → personal organ
  // (personal last → strongest influence + survives truncation).
  const seen = new Set<string>();
  const allTerms: string[] = [];
  for (const term of [...general, ...organSpecific, ...personalCross, ...personalOrgan]) {
    const t = term.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      allTerms.push(t);
    }
  }

  const prompt = assembleWithinBudget(PREAMBLE, allTerms, MAX_PROMPT_CHARS);
  promptCache.set(key, prompt);
  return prompt;
}

/**
 * Join the preamble + comma-separated terms under the char budget. When the
 * full list overflows, drop from the front (general hints) so the highest-
 * signal terms (organ-specific, personal) remain closest to the end of the
 * prompt where Whisper weighs them most.
 */
function assembleWithinBudget(preamble: string, terms: string[], maxChars: number): string {
  const build = (ts: string[]) => `${preamble} ${ts.join(', ')}.`;
  let retained = [...terms];
  while (retained.length > 0 && build(retained).length > maxChars) {
    retained.shift();
  }
  return retained.length > 0 ? build(retained) : preamble;
}

/**
 * Clear the in-memory prompt cache. Call after the personal dictionary
 * changes, or between test runs.
 */
export function clearWhisperPromptCache(): void {
  promptCache.clear();
}
