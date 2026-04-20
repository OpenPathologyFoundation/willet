import { http, HttpResponse, delay } from 'msw';
import { fixtureIndex } from './fixtures/cases';
import { clinicalFixtureIndex } from './fixtures/clinical-context';
import { findTemplate } from './fixtures/templates';
import type { SavePartRequest, SavePartResponse, FinalizeRequest, LlmInstructionRequest } from '$lib/types';
import type { UserPreferences } from '$lib/stores/preferences.svelte';
import { mockInterpretInstruction } from './llm-mock';
import { normalizeDictation, type NormalizationRequest } from '$lib/services/dictation-normalizer';
import { correctTranscription as localCorrect } from '$lib/services/transcription-correction';
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

  // NOTE: /api/interpret is normally passed through to the MCP server. The handler
  // below handles the dev-harness standardize pattern with a set_authored_label
  // action, AND — for any other instruction — delegates to the rules-engine
  // mock (mockInterpretInstruction). This keeps the "Ask AI" button and the
  // `ai:` / `@ai` / `use ai` keyword prefixes functional in standalone mode
  // without a running MCP. In production, both paths hit the real LLM; the
  // dev-harness returns rules-engine-equivalent results tagged `ai_suggested`
  // at the caller, which demonstrates the SDS §5.5 confirmation flow honestly.
  //
  // Real MCP is still reachable when running alongside the dev server — this
  // handler returns a concrete response rather than passthrough so the LLM
  // UI paths always produce visible results. A production deployment replaces
  // the entire handler with a real-LLM endpoint.
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

    // Fallback: delegate to the rules-engine mock so Ask-AI and keyword-prefix
    // routes produce meaningful responses in the dev harness. PromptArea tags
    // this response as `source: 'ai_suggested'`, which drives the v2.3
    // confirmation flow regardless of the dev-harness source of the actions.
    await delay(150);
    const response = mockInterpretInstruction(body);
    return HttpResponse.json({
      ...response,
      summary: `${response.summary} (dev-harness LLM)`,
      provider: 'mock-dev-harness-fallback',
    });
  }),

  // GET /api/mnemonics/search — Mnemonic search (standalone mock)
  http.get('/api/mnemonics/search', async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();
    if (!q) {
      return HttpResponse.json({ hits: [], totalHits: 0, processingTimeMs: 1 });
    }

    // Simple prefix/substring match against mock mnemonics
    const hits = MOCK_MNEMONICS.filter(m =>
      m.abbr.toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q) ||
      m.mnemonic.toLowerCase().includes(q) ||
      (m.lookupDisplay ?? '').toLowerCase().includes(q),
    );

    return HttpResponse.json({
      hits: hits.slice(0, 20),
      totalHits: hits.length,
      processingTimeMs: 5,
    });
  }),

  // POST /api/mnemonics/:mnemonicId/use — Record usage (no-op in standalone)
  http.post('/api/mnemonics/:mnemonicId/use', async () => {
    await delay(50);
    return new HttpResponse(null, { status: 200 });
  }),

  // GET /api/mnemonics/top — Top mnemonics (empty in standalone)
  http.get('/api/mnemonics/top', async () => {
    await delay(50);
    return HttpResponse.json([]);
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
// Mock mnemonic data for standalone mode
// ---------------------------------------------------------------------------

const MOCK_MNEMONICS = [
  {
    mnemonicId: 'mn-001',
    abbr: 'HR2',
    mnemonic: 'HR2',
    description: 'High risk genotypes',
    lookupDisplay: 'HPV-Hi',
    commentText: 'High Risk Type HPV-DNA was performed by PCR amplification. High-risk HPV genotypes DETECTED.',
    texttypeId: '$procint',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-002',
    abbr: 'QC',
    mnemonic: 'QC',
    description: 'GI',
    lookupDisplay: 'Chronic gastritis',
    commentText: 'Gastric antral-type mucosa with chronic inactive gastritis.\nNo intestinal metaplasia identified.\nNo Helicobacter organisms identified on H&E.',
    texttypeId: '$final',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-003',
    abbr: 'ADEN',
    mnemonic: 'ADEN',
    description: 'Colon',
    lookupDisplay: 'Tubular adenoma',
    commentText: 'Tubular adenoma with low-grade dysplasia.\nNo high-grade dysplasia or invasive carcinoma identified.',
    texttypeId: '$final',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-004',
    abbr: 'NMLB',
    mnemonic: 'NMLB',
    description: 'Breast',
    lookupDisplay: 'Benign breast',
    commentText: 'Breast tissue with fibrocystic changes.\nNo atypia or malignancy identified.',
    texttypeId: '$final',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-005',
    abbr: 'MSI',
    mnemonic: 'MSI',
    description: 'Molecular',
    lookupDisplay: 'MSI stable',
    commentText: 'Microsatellite instability (MSI) testing was performed by immunohistochemistry for MLH1, MSH2, MSH6, and PMS2.\nAll four mismatch repair proteins show intact nuclear expression.\nInterpretation: Microsatellite stable (MSS).',
    texttypeId: '$procint',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-006',
    abbr: 'HPNEG',
    mnemonic: 'HPNEG',
    description: 'GI',
    lookupDisplay: 'H. pylori negative',
    commentText: 'Giemsa stain is negative for Helicobacter pylori organisms.',
    texttypeId: '$procres',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-007',
    abbr: 'PROS',
    mnemonic: 'PROS',
    description: 'Prostate',
    lookupDisplay: 'Benign prostate',
    commentText: 'Benign prostatic tissue with nodular hyperplasia.\nNo adenocarcinoma identified.',
    texttypeId: '$final',
    userUseCount: 0,
  },
  {
    mnemonicId: 'mn-008',
    abbr: 'IHC4',
    mnemonic: 'IHC4',
    description: 'Breast IHC panel',
    lookupDisplay: 'ER/PR/HER2/Ki67',
    commentText: 'Estrogen receptor (ER): Positive, >95% of tumor nuclei, strong intensity.\nProgesterone receptor (PR): Positive, 80% of tumor nuclei, moderate intensity.\nHER2: Negative (score 1+) by immunohistochemistry.\nKi-67 proliferation index: 15%.',
    texttypeId: '$procint',
    userUseCount: 0,
  },
];
