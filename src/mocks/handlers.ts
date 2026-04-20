import { http, HttpResponse, delay, passthrough } from 'msw';
import { fixtureIndex } from './fixtures/cases';
import { clinicalFixtureIndex } from './fixtures/clinical-context';
import { findTemplate } from './fixtures/templates';
import type { SavePartRequest, SavePartResponse, FinalizeRequest, LlmInstructionRequest } from '$lib/types';
import type { UserPreferences } from '$lib/stores/preferences.svelte';
import { mockInterpretInstruction } from './llm-mock';
import { normalizeDictation, type NormalizationRequest } from '$lib/services/dictation-normalizer';
import { correctTranscription as localCorrect } from '$lib/services/transcription-correction';
import personalVocabGershkovich from '../../mcp-server/data/personal-vocab-gershkovich.json';
import { MnemonicStore, MnemonicStoreError, type MnemonicTier } from '$lib/services/mnemonic-store';

/**
 * Turn any error into a JSON response with an appropriate status. We match on
 * a `code` string rather than `instanceof MnemonicStoreError` because Vite HMR
 * can reload the store module independently from handlers.ts, which gives the
 * two files different class references — `instanceof` then returns false for
 * errors thrown by the store, falling through to a confusing 500.
 */
function mnemonicErrorResponse(e: unknown): Response {
  const code = (e as { code?: string } | undefined)?.code;
  const message = e instanceof Error ? e.message : String(e);
  const KNOWN_CODES = ['not_found', 'forbidden', 'immutable', 'invalid_abbr', 'abbr_exists', 'wrong_tier'] as const;
  if (code && (KNOWN_CODES as readonly string[]).includes(code)) {
    const status = code === 'not_found' ? 404
      : code === 'forbidden' || code === 'immutable' ? 403
      : code === 'abbr_exists' ? 409
      : 400;
    return HttpResponse.json({ error: message, code }, { status });
  }
  console.error('[mnemonic handler] unexpected error:', e);
  return HttpResponse.json({ error: message, code: 'internal' }, { status: 500 });
}
import {
  NomenclatureStore,
  type CreateStagingInput,
  type Confirmation,
  type CreatePersonalInput,
  type OverrideRecord,
} from '$lib/services/nomenclature';

// In-memory user preferences (standalone persistence)
let mockPreferences: Partial<UserPreferences> = {};

// In-memory state for autosave persistence during dev session
const savedParts = new Map<string, { finalDiagnosis: string; metadata: Record<string, unknown> }>();
const savedCaseComments = new Map<string, string>();

// Module-level NomenclatureStore singleton for standalone mode. In integrated
// mode the server (auth-system) owns the authoritative store; here we simulate
// it per dev session. Exported for tests that need to reset between runs.
export const mockNomenclatureStore = new NomenclatureStore();

/**
 * Dev-harness pattern that simulates an LLM-inferred label standardization so
 * the nomenclature staging lifecycle (SDS 04-04 §3.1) can be exercised in
 * standalone mode without a running MCP server. Matches both at the rules-engine
 * endpoint (forcing an empty-actions response to trigger escalation) and at
 * the /api/interpret endpoint (where the set_authored_label action is emitted).
 */
const DEV_HARNESS_STANDARDIZE_PATTERN = /^\s*(?:standardize|rename)\s+part\s+([A-Za-z0-9]+)\s+(?:as|to)\s+["']?(.+?)["']?\s*\.?\s*$/i;

export const handlers = [
  // GET /api/report/:caseId/scaffold — Load report scaffold
  http.get('/api/report/:caseId/scaffold', async ({ params }) => {
    await delay(200); // Simulate network latency

    const caseId = params.caseId as string;
    const scaffold = fixtureIndex[caseId];

    if (!scaffold) {
      return HttpResponse.json(
        { error: `Case not found: ${caseId}` },
        { status: 404 },
      );
    }

    // Apply any saved state from autosave
    const result = structuredClone(scaffold);
    for (const part of result.parts) {
      const key = `${caseId}:${part.id}`;
      const saved = savedParts.get(key);
      if (saved) {
        part.finalDiagnosis = saved.finalDiagnosis;
        part.metadata = { ...part.metadata, ...saved.metadata };
      }
    }

    // Apply saved case comment
    const savedComment = savedCaseComments.get(caseId);
    if (savedComment !== undefined) {
      result.caseComment = savedComment;
    }

    return HttpResponse.json(result);
  }),

  // PUT /api/report/:caseId/parts/:partId — Autosave
  http.put('/api/report/:caseId/parts/:partId', async ({ params, request }) => {
    await delay(100);

    const caseId = params.caseId as string;
    const partId = params.partId as string;
    const body = (await request.json()) as SavePartRequest;

    const scaffold = fixtureIndex[caseId];
    if (!scaffold) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (scaffold.reportState === 'FINALIZED') {
      return HttpResponse.json(
        { error: 'Report is finalized' },
        { status: 409 },
      );
    }

    if (scaffold.case.status === 'archived') {
      return HttpResponse.json(
        { error: 'Case signed out in LIS' },
        { status: 409 },
      );
    }

    // Persist in memory
    const key = `${caseId}:${partId}`;
    savedParts.set(key, {
      finalDiagnosis: body.finalDiagnosis,
      metadata: body.metadata,
    });

    const response: SavePartResponse = {
      savedAt: new Date().toISOString(),
    };
    return HttpResponse.json(response);
  }),

  // PATCH /api/report/:caseId/parts/:partId/header — Update authored_label
  http.patch('/api/report/:caseId/parts/:partId/header', async ({ params, request }) => {
    await delay(100);

    const caseId = params.caseId as string;
    const partId = params.partId as string;
    const body = (await request.json()) as { authored_label: string };

    const key = `${caseId}:${partId}`;
    const existing = savedParts.get(key) ?? { finalDiagnosis: '', metadata: {} };
    existing.metadata = { ...existing.metadata, authored_label: body.authored_label };
    savedParts.set(key, existing);

    return HttpResponse.json({ savedAt: new Date().toISOString() });
  }),

  // PUT /api/report/:caseId/comment — Save case comment (SRS-261)
  http.put('/api/report/:caseId/comment', async ({ params, request }) => {
    await delay(100);

    const caseId = params.caseId as string;
    const body = (await request.json()) as { caseComment: string };

    const scaffold = fixtureIndex[caseId];
    if (!scaffold) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (scaffold.reportState === 'FINALIZED') {
      return HttpResponse.json({ error: 'Report is finalized' }, { status: 409 });
    }

    savedCaseComments.set(caseId, body.caseComment);

    return HttpResponse.json({ savedAt: new Date().toISOString() });
  }),

  // POST /api/report/:caseId/finalize — Finalize report
  http.post('/api/report/:caseId/finalize', async ({ params, request }) => {
    await delay(300);

    const caseId = params.caseId as string;
    const body = (await request.json()) as FinalizeRequest;
    const scaffold = fixtureIndex[caseId];

    if (!scaffold) {
      return HttpResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (scaffold.reportState === 'FINALIZED') {
      return HttpResponse.json({ error: 'Already finalized' }, { status: 409 });
    }

    // Transition fixture state so subsequent scaffold loads reflect finalized
    scaffold.reportState = 'FINALIZED';

    return HttpResponse.json({
      id: crypto.randomUUID(),
      idempotencyKey: body.idempotencyKey,
      finalizedBy: 'mock-user',
      finalizedAt: new Date().toISOString(),
      status: 'PENDING',
      hl7ErrorCode: null,
    }, { status: 201 });
  }),

  // GET /api/report/:caseId/transmission — Poll transmission status (stub)
  http.get('/api/report/:caseId/transmission', async () => {
    await delay(100);
    // In standalone mode, simulate instant ACKED for dev convenience
    return HttpResponse.json({
      id: 'tx-mock-001',
      idempotencyKey: 'mock-key',
      finalizedBy: 'mock-user',
      finalizedAt: new Date().toISOString(),
      status: 'ACKED',
      hl7ErrorCode: null,
    });
  }),

  // POST /api/report/:caseId/instruct — Conversational authoring (mock LLM)
  http.post('/api/report/:caseId/instruct', async ({ request }) => {
    await delay(400); // Simulate LLM processing time

    const body = (await request.json()) as LlmInstructionRequest;

    // Dev-harness: for the "standardize/rename part X as Y" pattern, the rules
    // engine mock returns an empty-actions response so PromptArea escalates to
    // the LLM handler at /api/interpret (which produces the set_authored_label
    // action tagged 'ai_suggested'). Without this short-circuit, the classifier
    // would match "part A" as a content intent and never escalate.
    if (DEV_HARNESS_STANDARDIZE_PATTERN.test(body.instruction)) {
      return HttpResponse.json({
        actions: [],
        clarifications: [],
        confidence: 0,
        summary: 'Escalating to LLM for label standardization',
      });
    }

    const response = mockInterpretInstruction(body);
    return HttpResponse.json(response);
  }),

  // GET /api/report/:caseId/clinical — Clinical context bundle (SDS 04-01 §12)
  http.get('/api/report/:caseId/clinical', async ({ params }) => {
    await delay(300); // Simulate network latency (separate from scaffold)

    const caseId = params.caseId as string;
    const bundle = clinicalFixtureIndex[caseId];

    if (!bundle) {
      // Cases without clinical context data get an empty bundle
      return HttpResponse.json({
        caseId,
        patientMrn: fixtureIndex[caseId]?.patient?.mrn ?? 'UNKNOWN',
        surgicalNotes: [],
        radiologyReports: [],
        priorPathology: [],
      });
    }

    return HttpResponse.json(bundle);
  }),

  // GET /api/templates/:specimenType — Template resolution (SDS 04-01 §13)
  http.get('/api/templates/:specimenType', async ({ params }) => {
    await delay(100);

    const specimenType = decodeURIComponent(params.specimenType as string);
    const template = findTemplate(specimenType);

    if (!template) {
      return HttpResponse.json({ error: 'No template found' }, { status: 404 });
    }

    return HttpResponse.json(template);
  }),

  // GET /api/user/preferences — User preferences (SRS-190)
  http.get('/api/user/preferences', async () => {
    await delay(50);
    return HttpResponse.json(mockPreferences);
  }),

  // PUT /api/user/preferences — Save preferences (SRS-191)
  http.put('/api/user/preferences', async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as Partial<UserPreferences>;
    mockPreferences = { ...mockPreferences, ...body };
    return HttpResponse.json({ savedAt: new Date().toISOString() });
  }),

  // POST /api/dictation/normalize — Clause-type normalization (SRS-187)
  http.post('/api/dictation/normalize', async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as NormalizationRequest;
    const result = normalizeDictation(body);
    return HttpResponse.json(result);
  }),

  // GET /api/vocabulary/personal — Per-pathologist Whisper vocabulary file.
  // In standalone mode the same example fixture is returned for every userId
  // so the demo works without a real data store. In integrated mode a real
  // endpoint looks up the file by userId.
  http.get('/api/vocabulary/personal', async () => {
    await delay(30);
    return HttpResponse.json(personalVocabGershkovich);
  }),

  // POST /api/transcription/correct — Vocabulary correction (SRS-185, SDS 04-03 §16.3)
  // In standalone mode, runs the same deterministic correction as the local function.
  // In integrated mode, this would proxy to the MCP server at POST /correct.
  http.post('/api/transcription/correct', async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as { text: string; specimenType: string | null };
    const result = localCorrect(body.text, body.specimenType);
    return HttpResponse.json({
      corrected: result.text,
      changes: result.corrections.map(c => ({
        original: c.original,
        corrected: c.replacement,
        type: 'confusion_pair',
        position: c.start,
      })),
      raw: body.text,
    });
  }),

  // /api/interpret — routes to the real MCP server (:8001/interpret) via the
  // Vite proxy in vite.config.ts, where interpret_with_anthropic/openai make
  // a real LLM call. The only exception is the dev-harness standardize pattern,
  // which returns a `set_authored_label` action shape directly so the label
  // standardization demo remains deterministic without depending on the LLM
  // inferring that exact action shape. Every other instruction passes through.
  http.post('/api/interpret', async ({ request }) => {
    const body = (await request.clone().json()) as LlmInstructionRequest;
    const match = body.instruction.match(DEV_HARNESS_STANDARDIZE_PATTERN);

    if (match) {
      const partLabel = match[1].toUpperCase();
      const newLabel = match[2].trim();
      const targetPart = body.caseContext.parts.find((p) => p.partLabel === partLabel);
      if (targetPart) {
        await delay(100);
        return HttpResponse.json({
          actions: [
            {
              type: 'set_authored_label',
              partLabel,
              payload: { label: newLabel },
              confidence: 0.85,
            },
          ],
          clarifications: [],
          confidence: 0.85,
          summary: `Standardize Part ${partLabel} label to "${newLabel}"`,
          provider: 'mock-dev-harness',
        });
      }
    }

    return passthrough();
  }),

  // GET /api/mnemonics/search — Mnemonic search backed by MnemonicStore (UN-097).
  http.get('/api/mnemonics/search', async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const texttype = url.searchParams.get('texttype') ?? undefined;
    const userId = url.searchParams.get('userId') ?? undefined;
    const tiersParam = url.searchParams.get('tiers');
    const tiers = tiersParam
      ? (tiersParam.split(',').filter((t) => t === 'personal' || t === 'institutional' || t === 'seed') as MnemonicTier[])
      : undefined;
    const includeRetired = url.searchParams.get('includeRetired') === '1';
    const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);

    const hits = mockMnemonicStore.search(q, { tiers, userId, texttype, includeRetired, limit });
    return HttpResponse.json({
      hits,
      totalHits: hits.length,
      processingTimeMs: 5,
    });
  }),

  // POST /api/mnemonics — Create a personal mnemonic (UN-097).
  http.post('/api/mnemonics', async ({ request }) => {
    await delay(60);
    const body = (await request.json()) as {
      abbr: string;
      mnemonic?: string;
      description?: string | null;
      lookupDisplay?: string | null;
      commentText: string;
      texttypeId: string;
      userId: string;
    };
    try {
      const entry = mockMnemonicStore.createPersonal(body);
      return HttpResponse.json(toMnemonicHit(entry));
    } catch (e) {
      return mnemonicErrorResponse(e);
    }
  }),

  // PUT /api/mnemonics/:id — Update editable fields (UN-097).
  http.put('/api/mnemonics/:id', async ({ params, request }) => {
    const id = params.id as string;
    console.log('[mnemonic PUT] entered', id);
    await delay(60);
    try {
      // Body parsing lives inside try so malformed JSON returns 400, not 500.
      const body = (await request.json()) as {
        userId: string;
        isAdmin: boolean;
        description?: string | null;
        lookupDisplay?: string | null;
        commentText?: string;
        texttypeId?: string;
      };
      const entry = mockMnemonicStore.update({
        mnemonicId: id,
        userId: body.userId,
        isAdmin: body.isAdmin,
        description: body.description,
        lookupDisplay: body.lookupDisplay,
        commentText: body.commentText,
        texttypeId: body.texttypeId,
      });
      return HttpResponse.json(toMnemonicHit(entry));
    } catch (e) {
      return mnemonicErrorResponse(e);
    }
  }),

  // POST /api/mnemonics/:id/promote — Promote personal → institutional (UN-097).
  http.post('/api/mnemonics/:id/promote', async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as { promotedBy: string };
    try {
      const { institutional, personal } = mockMnemonicStore.promoteToInstitutional({
        mnemonicId: id,
        promotedBy: body.promotedBy,
      });
      return HttpResponse.json({
        institutional: toMnemonicHit(institutional),
        personal: toMnemonicHit(personal),
      });
    } catch (e) {
      return mnemonicErrorResponse(e);
    }
  }),

  // POST /api/mnemonics/:id/retire — Retire (governance + seed immutability enforced server-side).
  http.post('/api/mnemonics/:id/retire', async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as { userId: string; isAdmin: boolean };
    try {
      const entry = mockMnemonicStore.retire({
        mnemonicId: id,
        userId: body.userId,
        isAdmin: body.isAdmin,
      });
      return HttpResponse.json(toMnemonicHit(entry));
    } catch (e) {
      return mnemonicErrorResponse(e);
    }
  }),

  // POST /api/mnemonics/:id/unretire — Reverse retirement.
  http.post('/api/mnemonics/:id/unretire', async ({ params, request }) => {
    await delay(60);
    const id = params.id as string;
    const body = (await request.json()) as { userId: string; isAdmin: boolean };
    try {
      const entry = mockMnemonicStore.unretire({
        mnemonicId: id,
        userId: body.userId,
        isAdmin: body.isAdmin,
      });
      return HttpResponse.json(toMnemonicHit(entry));
    } catch (e) {
      return mnemonicErrorResponse(e);
    }
  }),

  // POST /api/mnemonics/:mnemonicId/use — Record usage and update rank.
  http.post('/api/mnemonics/:mnemonicId/use', async ({ params }) => {
    await delay(40);
    mockMnemonicStore.recordUsage(params.mnemonicId as string);
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /api/mnemonics/top — Top mnemonics for the current user (standalone stub).
  http.get('/api/mnemonics/top', async () => {
    await delay(50);
    return HttpResponse.json([]);
  }),

  // POST /api/mnemonics/_reset — Dev-only isolation; resets and re-seeds.
  http.post('/api/mnemonics/_reset', async () => {
    seedMnemonicStore();
    return HttpResponse.json({ ok: true });
  }),

  // POST /api/audit/events — Audit event sink (no-op in standalone)
  http.post('/api/audit/events', async () => {
    return HttpResponse.json({ accepted: true });
  }),

  // ---------------------------------------------------------------------------
  // Nomenclature staging dictionary (SDS 04-04 §3.1–§3.2)
  // ---------------------------------------------------------------------------

  // POST /api/nomenclature/staging — Create (or dedup+confirm) a staging entry
  http.post('/api/nomenclature/staging', async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as CreateStagingInput;
    const result = mockNomenclatureStore.createStagingEntry(body);
    return HttpResponse.json(result);
  }),

  // POST /api/nomenclature/staging/:id/confirm — Append a confirmation
  http.post('/api/nomenclature/staging/:id/confirm', async ({ params, request }) => {
    await delay(50);
    const id = params.id as string;
    const body = (await request.json()) as Confirmation;
    try {
      const result = mockNomenclatureStore.appendConfirmation(id, body);
      return HttpResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return HttpResponse.json({ error: msg }, { status: 404 });
    }
  }),

  // POST /api/nomenclature/staging/:id/promote — Promote if eligible
  http.post('/api/nomenclature/staging/:id/promote', async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    try {
      const result = mockNomenclatureStore.promoteIfEligible(id);
      return HttpResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return HttpResponse.json({ error: msg }, { status: 404 });
    }
  }),

  // GET /api/nomenclature/staging — List all non-retired staging entries
  http.get('/api/nomenclature/staging', async () => {
    await delay(50);
    return HttpResponse.json(mockNomenclatureStore.getByTier('staging'));
  }),

  // GET /api/nomenclature/institutional — List all non-retired institutional entries
  http.get('/api/nomenclature/institutional', async () => {
    await delay(50);
    return HttpResponse.json(mockNomenclatureStore.getByTier('institutional'));
  }),

  // POST /api/nomenclature/_reset — Dev-only test isolation endpoint (no production equivalent).
  // Replaces the in-memory NomenclatureStore with a fresh instance so E2E tests can run
  // without inheriting state from earlier runs. Not present in integrated mode.
  http.post('/api/nomenclature/_reset', async () => {
    mockNomenclatureStore.reset();
    return HttpResponse.json({ ok: true });
  }),

  // Personal dictionary (SDS 04-04 §2.1) — pathologist-owned shortcuts.

  http.post('/api/nomenclature/personal', async ({ request }) => {
    await delay(50);
    const body = (await request.json()) as CreatePersonalInput;
    const result = mockNomenclatureStore.createPersonalEntry(body);
    return HttpResponse.json(result);
  }),

  http.get('/api/nomenclature/personal', async ({ request }) => {
    await delay(50);
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') ?? undefined;
    return HttpResponse.json(mockNomenclatureStore.getPersonalEntries(userId));
  }),

  http.delete('/api/nomenclature/personal/:id', async ({ params }) => {
    await delay(50);
    const id = params.id as string;
    try {
      mockNomenclatureStore.deletePersonalEntry(id);
      return HttpResponse.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return HttpResponse.json({ error: msg }, { status: 404 });
    }
  }),

  // POST /api/nomenclature/:id/override — Record a substantive pathologist
  // override of a deterministic output (SDS 04-04 §3.4). Triggers quarantine
  // when the override count within the window reaches the threshold.
  http.post('/api/nomenclature/:id/override', async ({ params, request }) => {
    await delay(50);
    const id = params.id as string;
    const record = (await request.json()) as OverrideRecord;
    try {
      const result = mockNomenclatureStore.recordOverride({ entryId: id, record });
      return HttpResponse.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return HttpResponse.json({ error: msg }, { status: 404 });
    }
  }),
];

// ---------------------------------------------------------------------------
// Mnemonic store singleton + seed data (UN-097, §5.28)
// ---------------------------------------------------------------------------

export const mockMnemonicStore = new MnemonicStore();

function toMnemonicHit(entry: {
  mnemonicId: string; abbr: string; mnemonic: string;
  description: string | null; lookupDisplay: string | null;
  commentText: string; texttypeId: string; userUseCount: number;
  tier: MnemonicTier; retired: boolean; createdBy: string | null;
}) {
  return {
    mnemonicId: entry.mnemonicId,
    abbr: entry.abbr,
    mnemonic: entry.mnemonic,
    description: entry.description,
    lookupDisplay: entry.lookupDisplay,
    commentText: entry.commentText,
    texttypeId: entry.texttypeId,
    userUseCount: entry.userUseCount,
    tier: entry.tier,
    retired: entry.retired,
    createdBy: entry.createdBy,
  };
}

/** (Re-)seed the in-memory mnemonic store. Invoked at module load and /_reset. */
function seedMnemonicStore(): void {
  mockMnemonicStore.reset();
  const now = '2026-01-01T00:00:00Z';

  // Seed tier — the baseline shipped with the product.
  mockMnemonicStore.loadSeed([
    {
      mnemonicId: 'seed-hr2', abbr: 'HR2', mnemonic: 'HR2',
      description: 'High risk genotypes', lookupDisplay: 'HPV-Hi',
      commentText: 'High Risk Type HPV-DNA was performed by PCR amplification. High-risk HPV genotypes DETECTED.',
      texttypeId: '$procint',
      tier: 'seed', createdBy: null, createdAt: now, lastUsedAt: null, userUseCount: 0,
    },
    {
      mnemonicId: 'seed-qc', abbr: 'QC', mnemonic: 'QC',
      description: 'GI', lookupDisplay: 'Chronic gastritis',
      commentText: 'Gastric antral-type mucosa with chronic inactive gastritis.\nNo intestinal metaplasia identified.\nNo Helicobacter organisms identified on H&E.',
      texttypeId: '$final',
      tier: 'seed', createdBy: null, createdAt: now, lastUsedAt: null, userUseCount: 0,
    },
    {
      mnemonicId: 'seed-msi', abbr: 'MSI', mnemonic: 'MSI',
      description: 'Molecular', lookupDisplay: 'MSI stable',
      commentText: 'Microsatellite instability (MSI) testing was performed by immunohistochemistry for MLH1, MSH2, MSH6, and PMS2.\nAll four mismatch repair proteins show intact nuclear expression.\nInterpretation: Microsatellite stable (MSS).',
      texttypeId: '$procint',
      tier: 'seed', createdBy: null, createdAt: now, lastUsedAt: null, userUseCount: 0,
    },
    {
      mnemonicId: 'seed-hpneg', abbr: 'HPNEG', mnemonic: 'HPNEG',
      description: 'GI', lookupDisplay: 'H. pylori negative',
      commentText: 'Giemsa stain is negative for Helicobacter pylori organisms.',
      texttypeId: '$procres',
      tier: 'seed', createdBy: null, createdAt: now, lastUsedAt: null, userUseCount: 0,
    },
    {
      mnemonicId: 'seed-ihc4', abbr: 'IHC4', mnemonic: 'IHC4',
      description: 'Breast IHC panel', lookupDisplay: 'ER/PR/HER2/Ki67',
      commentText: 'Estrogen receptor (ER): Positive, >95% of tumor nuclei, strong intensity.\nProgesterone receptor (PR): Positive, 80% of tumor nuclei, moderate intensity.\nHER2: Negative (score 1+) by immunohistochemistry.\nKi-67 proliferation index: 15%.',
      texttypeId: '$procint',
      tier: 'seed', createdBy: null, createdAt: now, lastUsedAt: null, userUseCount: 0,
    },
  ]);

  // Institutional tier — promoted & maintained by the organization.
  mockMnemonicStore.loadSeed([
    {
      mnemonicId: 'inst-aden', abbr: 'ADEN', mnemonic: 'ADEN',
      description: 'Colon', lookupDisplay: 'Tubular adenoma (institutional)',
      commentText: 'Tubular adenoma with low-grade dysplasia.\nNo high-grade dysplasia or invasive carcinoma identified.\nMargins: not applicable.',
      texttypeId: '$final',
      tier: 'institutional', createdBy: 'admin-user', createdAt: now, lastUsedAt: null, userUseCount: 3,
    },
    {
      mnemonicId: 'inst-nmlb', abbr: 'NMLB', mnemonic: 'NMLB',
      description: 'Breast', lookupDisplay: 'Benign breast (institutional)',
      commentText: 'Breast tissue with fibrocystic changes.\nNo atypia, in-situ disease, or malignancy identified.',
      texttypeId: '$final',
      tier: 'institutional', createdBy: 'admin-user', createdAt: now, lastUsedAt: null, userUseCount: 7,
    },
  ]);

  // Personal tier — two examples for the demo user so the governance badges
  // and filters are meaningful out of the box.
  mockMnemonicStore.loadSeed([
    {
      mnemonicId: 'pers-pros', abbr: 'PROS', mnemonic: 'PROS',
      description: 'Prostate (mine)', lookupDisplay: 'Benign prostate — my phrasing',
      commentText: 'Benign prostatic tissue with nodular hyperplasia.\nNo adenocarcinoma, HGPIN, or atypical small acinar proliferation identified.',
      texttypeId: '$final',
      tier: 'personal', createdBy: 'gershkovich', createdAt: now, lastUsedAt: null, userUseCount: 12,
    },
    {
      mnemonicId: 'pers-nmlb', abbr: 'NMLB', mnemonic: 'NMLB',
      description: 'Breast (my version)', lookupDisplay: 'Benign breast — my phrasing',
      commentText: 'Fragments of benign breast tissue with fibrocystic changes, usual ductal hyperplasia, and apocrine metaplasia.\nNo atypia or malignancy identified.',
      texttypeId: '$final',
      tier: 'personal', createdBy: 'gershkovich', createdAt: now, lastUsedAt: null, userUseCount: 5,
    },
  ]);
}

seedMnemonicStore();
