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
  CreatePersonalInput,
  PersonalResult,
  OverrideRecord,
  OverrideResult,
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
  searchMnemonics(query: string, options?: MnemonicSearchOptions): Promise<MnemonicSearchResponse>;
  recordMnemonicUsage(mnemonicId: string): Promise<void>;
  getTopMnemonics(limit?: number): Promise<MnemonicHit[]>;

  // Mnemonic governance (UN-097, proposed — §5.28)
  createMnemonic(input: CreateMnemonicInput): Promise<MnemonicHit>;
  updateMnemonic(mnemonicId: string, input: UpdateMnemonicInput): Promise<MnemonicHit>;
  promoteMnemonic(mnemonicId: string, promotedBy: string): Promise<PromoteMnemonicResult>;
  retireMnemonic(mnemonicId: string, userId: string, isAdmin: boolean): Promise<MnemonicHit>;
  unretireMnemonic(mnemonicId: string, userId: string, isAdmin: boolean): Promise<MnemonicHit>;
  normalizeDictation(text: string, clauseType: ClauseType, specimenType: string | null): Promise<{ text: string; normalized: boolean }>;
  correctTranscription(text: string, specimenType: string | null): Promise<{ corrected: string; changes: Array<{ original: string; corrected: string; type: string; position: number }>; raw: string }>;
  interpretInstruction(instruction: string, caseContext: LlmInstructionRequest['caseContext'], conversationHistory?: LlmInstructionRequest['conversationHistory']): Promise<LlmInstructionResponse & { provider?: string }>;

  // Nomenclature staging (SDS 04-04 §3.1–§3.2)
  createNomenclatureStaging(input: CreateStagingInput): Promise<CreateStagingResult>;
  confirmNomenclatureStaging(entryId: string, confirmation: Confirmation): Promise<ConfirmationResult>;
  promoteNomenclatureStaging(entryId: string): Promise<PromotionResult | null>;
  listNomenclatureStaging(): Promise<NomenclatureEntry[]>;
  listNomenclatureInstitutional(): Promise<NomenclatureEntry[]>;

  // Personal dictionary (SDS 04-04 §2.1)
  createNomenclaturePersonal(input: CreatePersonalInput): Promise<PersonalResult>;
  listNomenclaturePersonal(userId?: string): Promise<NomenclatureEntry[]>;
  deleteNomenclaturePersonal(entryId: string): Promise<void>;

  // Override-quarantine (SDS 04-04 §3.4)
  recordNomenclatureOverride(entryId: string, record: OverrideRecord): Promise<OverrideResult>;
}

/** Options for the mnemonic search endpoint (UN-097). */
export interface MnemonicSearchOptions {
  texttype?: string;
  limit?: number;
  tiers?: ReadonlyArray<'personal' | 'institutional' | 'seed'>;
  userId?: string;
  includeRetired?: boolean;
}

/** Request body for the mnemonic create endpoint (UN-097). */
export interface CreateMnemonicInput {
  abbr: string;
  mnemonic?: string;
  description?: string | null;
  lookupDisplay?: string | null;
  commentText: string;
  texttypeId: string;
  userId: string;
}

/**
 * Request body for the mnemonic update endpoint (UN-097). Only editable
 * fields are sent; undefined fields are preserved server-side.
 */
export interface UpdateMnemonicInput {
  userId: string;
  isAdmin: boolean;
  description?: string | null;
  lookupDisplay?: string | null;
  commentText?: string;
  texttypeId?: string;
}

/** Result of promoting a personal mnemonic to institutional (UN-097). */
export interface PromoteMnemonicResult {
  institutional: MnemonicHit;
  personal: MnemonicHit;
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
    searchMnemonics(query, options = {}) {
      const params = new URLSearchParams({
        q: query,
        limit: String(options.limit ?? 20),
      });
      if (options.texttype) params.set('texttype', options.texttype);
      if (options.tiers && options.tiers.length > 0) {
        params.set('tiers', options.tiers.join(','));
      }
      if (options.userId) params.set('userId', options.userId);
      if (options.includeRetired) params.set('includeRetired', '1');
      return request<MnemonicSearchResponse>('GET', `/api/mnemonics/search?${params}`);
    },
    async recordMnemonicUsage(mnemonicId) {
      await request<void>('POST', `/api/mnemonics/${mnemonicId}/use`);
    },
    getTopMnemonics(limit = 10) {
      return request<MnemonicHit[]>('GET', `/api/mnemonics/top?limit=${limit}`);
    },
    createMnemonic(input) {
      return request<MnemonicHit>('POST', '/api/mnemonics', input);
    },
    updateMnemonic(mnemonicId, input) {
      return request<MnemonicHit>(
        'PUT',
        `/api/mnemonics/${encodeURIComponent(mnemonicId)}`,
        input,
      );
    },
    promoteMnemonic(mnemonicId, promotedBy) {
      return request<PromoteMnemonicResult>(
        'POST',
        `/api/mnemonics/${encodeURIComponent(mnemonicId)}/promote`,
        { promotedBy },
      );
    },
    retireMnemonic(mnemonicId, userId, isAdmin) {
      return request<MnemonicHit>(
        'POST',
        `/api/mnemonics/${encodeURIComponent(mnemonicId)}/retire`,
        { userId, isAdmin },
      );
    },
    unretireMnemonic(mnemonicId, userId, isAdmin) {
      return request<MnemonicHit>(
        'POST',
        `/api/mnemonics/${encodeURIComponent(mnemonicId)}/unretire`,
        { userId, isAdmin },
      );
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
    createNomenclaturePersonal(input) {
      return request<PersonalResult>('POST', '/api/nomenclature/personal', input);
    },
    listNomenclaturePersonal(userId) {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      return request<NomenclatureEntry[]>('GET', `/api/nomenclature/personal${qs}`);
    },
    async deleteNomenclaturePersonal(entryId) {
      await request<unknown>('DELETE', `/api/nomenclature/personal/${encodeURIComponent(entryId)}`);
    },
    recordNomenclatureOverride(entryId, record) {
      return request<OverrideResult>(
        'POST',
        `/api/nomenclature/${encodeURIComponent(entryId)}/override`,
        record,
      );
    },
  };
}
