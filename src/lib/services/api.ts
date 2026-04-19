// API client for WILLET
// In standalone mode, MSW intercepts these requests.
// In integrated mode, they hit real auth-system endpoints.

import type {
  ReportScaffold,
  SavePartRequest,
  SavePartResponse,
  SaveCaseCommentRequest,
  SaveCaseCommentResponse,
  FinalizeRequest,
  TransmissionRecord,
  LlmInstructionRequest,
  LlmInstructionResponse,
  ClinicalContextBundle,
  ClauseType,
  MnemonicHit,
  MnemonicSearchResponse,
} from '$lib/types';
import type { ReportTemplate } from '../../mocks/fixtures/templates';
import type { UserPreferences } from '$lib/stores/preferences.svelte';
import type {
  NomenclatureEntry,
  CreateStagingInput,
  CreateStagingResult,
  ConfirmationResult,
  PromotionResult,
  Confirmation,
} from './nomenclature';

export interface ApiClient {
  fetchScaffold(caseId: string): Promise<ReportScaffold>;
  savePart(caseId: string, partId: string, body: SavePartRequest): Promise<SavePartResponse>;
  saveCaseComment(caseId: string, body: SaveCaseCommentRequest): Promise<SaveCaseCommentResponse>;
  updateAuthoredLabel(caseId: string, partId: string, authoredLabel: string): Promise<void>;
  finalize(caseId: string, body: FinalizeRequest): Promise<TransmissionRecord>;
  getTransmission(caseId: string): Promise<TransmissionRecord>;
  sendInstruction(caseId: string, body: LlmInstructionRequest): Promise<LlmInstructionResponse>;
  fetchClinical(caseId: string): Promise<ClinicalContextBundle>;
  fetchTemplate(specimenType: string): Promise<ReportTemplate>;
  fetchPreferences(): Promise<Partial<UserPreferences>>;
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;
  searchMnemonics(query: string, texttype?: string, limit?: number): Promise<MnemonicSearchResponse>;
  recordMnemonicUsage(mnemonicId: string): Promise<void>;
  getTopMnemonics(limit?: number): Promise<MnemonicHit[]>;
  normalizeDictation(text: string, clauseType: ClauseType, specimenType: string | null): Promise<{ text: string; normalized: boolean }>;
  correctTranscription(text: string, specimenType: string | null): Promise<{ corrected: string; changes: Array<{ original: string; corrected: string; type: string; position: number }>; raw: string }>;
  interpretInstruction(instruction: string, caseContext: LlmInstructionRequest['caseContext'], conversationHistory?: LlmInstructionRequest['conversationHistory']): Promise<LlmInstructionResponse & { provider?: string }>;

  // Nomenclature staging (SDS 04-04 §3.1–§3.2)
  createNomenclatureStaging(input: CreateStagingInput): Promise<CreateStagingResult>;
  confirmNomenclatureStaging(entryId: string, confirmation: Confirmation): Promise<ConfirmationResult>;
  promoteNomenclatureStaging(entryId: string): Promise<PromotionResult | null>;
  listNomenclatureStaging(): Promise<NomenclatureEntry[]>;
  listNomenclatureInstitutional(): Promise<NomenclatureEntry[]>;
}

/** Typed API error with HTTP status and optional response body. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createApiClient(apiBase: string, getJwt: () => string): ApiClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getJwt()}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      let responseBody: Record<string, unknown> | undefined;
      try {
        responseBody = await res.json();
      } catch {
        // no JSON body
      }
      throw new ApiError(`API ${method} ${path}: ${res.status}`, res.status, responseBody);
    }

    return res.json() as Promise<T>;
  }

  return {
    fetchScaffold(caseId) {
      return request<ReportScaffold>('GET', `/api/report/${caseId}/scaffold`);
    },
    savePart(caseId, partId, body) {
      return request<SavePartResponse>('PUT', `/api/report/${caseId}/parts/${partId}`, body);
    },
    saveCaseComment(caseId, body) {
      return request<SaveCaseCommentResponse>('PUT', `/api/report/${caseId}/comment`, body);
    },
    async updateAuthoredLabel(caseId, partId, authoredLabel) {
      await request<unknown>('PATCH', `/api/report/${caseId}/parts/${partId}/header`, {
        authored_label: authoredLabel,
      });
    },
    finalize(caseId, body) {
      return request<TransmissionRecord>('POST', `/api/report/${caseId}/finalize`, body);
    },
    getTransmission(caseId) {
      return request<TransmissionRecord>('GET', `/api/report/${caseId}/transmission`);
    },
    sendInstruction(caseId, body) {
      return request<LlmInstructionResponse>('POST', `/api/report/${caseId}/instruct`, body);
    },
    fetchClinical(caseId) {
      return request<ClinicalContextBundle>('GET', `/api/report/${caseId}/clinical`);
    },
    fetchTemplate(specimenType) {
      return request<ReportTemplate>('GET', `/api/templates/${encodeURIComponent(specimenType)}`);
    },
    async fetchPreferences() {
      return request<Partial<UserPreferences>>('GET', '/api/user/preferences');
    },
    async savePreferences(prefs) {
      await request<unknown>('PUT', '/api/user/preferences', prefs);
    },
    searchMnemonics(query, texttype, limit = 20) {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (texttype) params.set('texttype', texttype);
      return request<MnemonicSearchResponse>('GET', `/api/mnemonics/search?${params}`);
    },
    async recordMnemonicUsage(mnemonicId) {
      await request<void>('POST', `/api/mnemonics/${mnemonicId}/use`);
    },
    getTopMnemonics(limit = 10) {
      return request<MnemonicHit[]>('GET', `/api/mnemonics/top?limit=${limit}`);
    },
    normalizeDictation(text, clauseType, specimenType) {
      return request<{ text: string; normalized: boolean }>('POST', '/api/dictation/normalize', {
        text,
        clauseType,
        specimenType,
      });
    },
    correctTranscription(text, specimenType) {
      return request<{ corrected: string; changes: Array<{ original: string; corrected: string; type: string; position: number }>; raw: string }>(
        'POST', '/api/transcription/correct', { text, specimenType },
      );
    },
    interpretInstruction(instruction, caseContext, conversationHistory) {
      return request<LlmInstructionResponse & { provider?: string }>(
        'POST', '/api/interpret', { instruction, caseContext, conversationHistory },
      );
    },
    createNomenclatureStaging(input) {
      return request<CreateStagingResult>('POST', '/api/nomenclature/staging', input);
    },
    confirmNomenclatureStaging(entryId, confirmation) {
      return request<ConfirmationResult>(
        'POST',
        `/api/nomenclature/staging/${encodeURIComponent(entryId)}/confirm`,
        confirmation,
      );
    },
    promoteNomenclatureStaging(entryId) {
      return request<PromotionResult | null>(
        'POST',
        `/api/nomenclature/staging/${encodeURIComponent(entryId)}/promote`,
      );
    },
    listNomenclatureStaging() {
      return request<NomenclatureEntry[]>('GET', '/api/nomenclature/staging');
    },
    listNomenclatureInstitutional() {
      return request<NomenclatureEntry[]>('GET', '/api/nomenclature/institutional');
    },
  };
}
