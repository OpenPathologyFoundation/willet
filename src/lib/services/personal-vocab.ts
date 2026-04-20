// Personal vocabulary loader — fetches the per-pathologist Whisper hint file
// and flattens it to the entry list shape consumed by whisper-prompt.ts.
//
// The file lives outside the shared pathology-vocabulary.json because it is
// per-user and edited independently. In integrated mode this endpoint is
// backed by a real database row keyed on userId; in standalone mode the MSW
// handler returns a fixture (mcp-server/data/personal-vocab-gershkovich.json)
// regardless of userId so the demo works out of the box.

import type { PersonalVocabEntry } from './whisper-prompt';

/**
 * On-disk / on-the-wire shape of a personal vocabulary file. Mirrors
 * personal-vocab-{userId}.json.
 */
export interface PersonalVocabDocument {
  version: string;
  userId: string;
  description?: string;
  organHints: Record<string, string[]>;
}

/**
 * Session cache — load once per userId, reuse for every recording.
 * The file is small (kilobytes) and not expected to change mid-session.
 */
const cache = new Map<string, PersonalVocabEntry[]>();

const inflight = new Map<string, Promise<PersonalVocabEntry[]>>();

/**
 * Fetch and flatten a pathologist's personal vocabulary file into the
 * {term, organKey} entry shape. Concurrent callers share a single fetch.
 */
export async function loadPersonalVocab(userId: string): Promise<PersonalVocabEntry[]> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const pending = inflight.get(userId);
  if (pending) return pending;

  const promise = fetchAndFlatten(userId)
    .then((entries) => {
      cache.set(userId, entries);
      inflight.delete(userId);
      return entries;
    })
    .catch((err) => {
      inflight.delete(userId);
      // Cache an empty list so one failed fetch doesn't hammer the endpoint.
      cache.set(userId, []);
      console.warn(`[personal-vocab] fetch failed for ${userId}, continuing without personal hints`, err);
      return [];
    });
  inflight.set(userId, promise);
  return promise;
}

async function fetchAndFlatten(userId: string): Promise<PersonalVocabEntry[]> {
  const response = await fetch(`/api/vocabulary/personal?userId=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Personal vocab fetch failed: ${response.status}`);
  }
  const doc = (await response.json()) as PersonalVocabDocument;
  return flatten(doc);
}

/**
 * Flatten the on-disk `{ organKey: string[] }` map into an entry list.
 * `_all` and any falsy organ key remain as `organKey: "_all"` so they
 * apply across every specimen.
 */
export function flatten(doc: PersonalVocabDocument): PersonalVocabEntry[] {
  const out: PersonalVocabEntry[] = [];
  for (const [organKey, terms] of Object.entries(doc.organHints ?? {})) {
    for (const term of terms) {
      const t = term.trim();
      if (!t) continue;
      out.push({ term: t, organKey: organKey || '_all' });
    }
  }
  return out;
}

/**
 * Clear the in-memory cache. Call after the pathologist edits their
 * personal dictionary, or between test runs.
 */
export function clearPersonalVocabCache(userId?: string): void {
  if (userId) {
    cache.delete(userId);
    inflight.delete(userId);
  } else {
    cache.clear();
    inflight.clear();
  }
}
