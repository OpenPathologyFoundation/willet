// API client for WILLET
// In standalone mode, MSW intercepts these requests.
// In integrated mode, they hit real auth-system endpoints.

import type {
  ReportScaffold,
  SavePartRequest,
  SavePartResponse,
  FinalizeRequest,
  TransmissionRecord,
  LlmInstructionRequest,
  LlmInstructionResponse,
  ClinicalContextBundle,
  ClauseType,
} from '$lib/types';
import type { ReportTemplate } from '../../mocks/fixtures/templates';
import type { UserPreferences } from '$lib/stores/preferences.svelte';

export interface ApiClient {
  fetchScaffold(caseId: string): Promise<ReportScaffold>;
  savePart(caseId: string, partId: string, body: SavePartRequest): Promise<SavePartResponse>;
  updateAuthoredLabel(caseId: string, partId: string, authoredLabel: string): Promise<void>;
  finalize(caseId: string, body: FinalizeRequest): Promise<TransmissionRecord>;
  getTransmission(caseId: string): Promise<TransmissionRecord>;
  sendInstruction(caseId: string, body: LlmInstructionRequest): Promise<LlmInstructionResponse>;
  fetchClinical(caseId: string): Promise<ClinicalContextBundle>;
  fetchTemplate(specimenType: string): Promise<ReportTemplate>;
  fetchPreferences(): Promise<Partial<UserPreferences>>;
  savePreferences(prefs: Partial<UserPreferences>): Promise<void>;
  normalizeDictation(text: string, clauseType: ClauseType, specimenType: string | null): Promise<{ text: string; normalized: boolean }>;
  correctTranscription(text: string, specimenType: string | null): Promise<{ corrected: string; changes: Array<{ original: string; corrected: string; type: string; position: number }>; raw: string }>;
  interpretInstruction(instruction: string, caseContext: LlmInstructionRequest['caseContext'], conversationHistory?: LlmInstructionRequest['conversationHistory']): Promise<LlmInstructionResponse & { provider?: string }>;
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
      const error = new Error(`API ${method} ${path}: ${res.status}`);
      (error as any).status = res.status;
      try {
        (error as any).body = await res.json();
      } catch {
        // no JSON body
      }
      throw error;
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
  };
}
