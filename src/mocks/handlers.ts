import { http, HttpResponse, delay } from 'msw';
import { fixtureIndex } from './fixtures/cases';
import { clinicalFixtureIndex } from './fixtures/clinical-context';
import { findTemplate } from './fixtures/templates';
import type { SavePartRequest, SavePartResponse, FinalizeRequest, LlmInstructionRequest } from '$lib/types';
import type { UserPreferences } from '$lib/stores/preferences.svelte';
import { mockInterpretInstruction } from './llm-mock';
import { normalizeDictation, type NormalizationRequest } from '$lib/services/dictation-normalizer';
import { correctTranscription as localCorrect } from '$lib/services/transcription-correction';

// In-memory user preferences (standalone persistence)
let mockPreferences: Partial<UserPreferences> = {};

// In-memory state for autosave persistence during dev session
const savedParts = new Map<string, { finalDiagnosis: string; metadata: Record<string, unknown> }>();

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

  // NOTE: /api/interpret is NOT handled by MSW — it passes through to the Vite proxy
  // which routes to the MCP server at localhost:8001/interpret for real LLM interpretation.
  // If the MCP server is not running, the fetch fails and the frontend uses the local fallback.

  // POST /api/audit/events — Audit event sink (no-op in standalone)
  http.post('/api/audit/events', async () => {
    return HttpResponse.json({ accepted: true });
  }),
];
