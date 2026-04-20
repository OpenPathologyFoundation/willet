// WILLET Type Definitions
// Derived from SDS 04-06 Data Model and SDS 04-01 Editor Architecture

// ---------------------------------------------------------------------------
// Roles and Permissions (URS §5.11)
// ---------------------------------------------------------------------------

export type UserRole = 'RESIDENT' | 'FELLOW' | 'ATTENDING' | 'DIRECTOR';

export type ReportPermission = 'CREATE' | 'EDIT' | 'FINALIZE';

// ---------------------------------------------------------------------------
// Module Events (URS §2.5.2)
// ---------------------------------------------------------------------------

export type ModuleEventType =
  | 'REPORT_OPENED'
  | 'REPORT_SAVED'
  | 'REPORT_FINALIZED'
  | 'LOCK_ACQUIRED'
  | 'LOCK_RELEASED'
  | 'LOCK_TAKEOVER_REQUESTED'
  | 'LOCK_TAKEOVER_APPROVED'
  | 'LOCK_TAKEOVER_REJECTED'
  | 'LOCK_FORCE_TAKEOVER'
  | 'LOCK_TIMEOUT'
  | 'DOCUMENT_VIEWED'
  | 'BREAK_GLASS_ACCESS'
  | 'NOMENCLATURE_OVERRIDE'
  | 'VOICE_COMMAND_EXECUTED'
  | 'SESSION_ERROR';

export interface ModuleEvent {
  type: ModuleEventType;
  caseId: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mount Props (URS §2.5.1, SDS 04-00 §4.1)
// ---------------------------------------------------------------------------

export interface ReportModuleProps {
  caseId: string;
  jwt: string;
  role: UserRole;
  /** Authenticated user identifier; defaults to a demo-user placeholder when omitted. */
  userId?: string;
  apiBase: string;
  onEvent: (event: ModuleEvent) => void;
}

// ---------------------------------------------------------------------------
// Clause Model (Addendum §8.5, SDS 04-01 §4.4)
// ---------------------------------------------------------------------------

export type ClauseType =
  | 'DIAGNOSIS'
  | 'MARGIN'
  | 'ANCILLARY'
  | 'SYNOPTIC_REF'
  | 'COMMENT';

export interface Clause {
  text: string;
  type: ClauseType;
  confidence?: number;
  /**
   * Provenance of the clause (SDS 04-04 §4.1, SRS-274). Drives the
   * `ProvenanceBadge` rendering next to clause text in the editor:
   *   - `'rule'` / `'institutional'` / `'seed'` → no badge (deterministic)
   *   - `'ai_suggested'` → "AI, verify" badge (LLM-derived, needs confirmation)
   *   - `'staged'` → "staged (N/5)" badge (partially-confirmed AI output)
   *   - `'ambiguous'` → "clarify" badge
   *   - undefined → user-authored / LIS-native (no badge)
   * Set by the action applier when clauses come from the §4 LLM interpreter
   * (source='ai_suggested'); unset by direct pathologist typing (clauses
   * typed in the editor remain unsourced, which renders as no badge).
   */
  source?: import('../services/source-policy').ActionSource;
}

// ---------------------------------------------------------------------------
// Report State (Spec §6.1)
// ---------------------------------------------------------------------------

export type ReportState = 'DRAFT' | 'REVIEW' | 'FINALIZED';

// ---------------------------------------------------------------------------
// Transmission Status (Addendum §9.3.3, SDS 04-06 §5.3)
// ---------------------------------------------------------------------------

export type TransmissionStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'ACKED'
  | 'NACKED'
  | 'FAILED';

// ---------------------------------------------------------------------------
// API Response Shapes (SDS 04-06 §7, §8)
// ---------------------------------------------------------------------------

export interface SlideRef {
  slideId: string;
  stain: string;
  magnification: number | null;
}

export interface PartData {
  id: string;
  partLabel: string;
  partDesignator: string | null;
  anatomicSite: string | null;
  finalDiagnosis: string | null;
  metadata: PartMetadata;
  slides: SlideRef[];
}

export interface PartMetadata {
  authored_label?: string;
  clause_types?: ClauseType[];
  confidence?: (number | undefined)[];
  /**
   * Per-clause provenance source tags, parallel to `clause_types` and
   * `confidence`. `undefined` entries mean the clause is user-authored /
   * LIS-native and renders without a provenance badge.
   */
  clause_sources?: (import('../services/source-policy').ActionSource | undefined)[];
  finalization?: FinalizationMetadata;
  [key: string]: unknown; // LIS-owned keys
}

export interface FinalizationMetadata {
  idempotency_key: string;
  finalized_by: string;
  finalized_at: string;
  version_hash: string;
  previous_attempts?: string[];
}

export interface PatientSummary {
  mrn: string;
  displayName: string;
  dob: string | null;
  sex: string | null;
}

export interface CaseSummary {
  id: string;
  caseId: string;
  collection: 'clinical' | 'educational';
  specimenType: string | null;
  clinicalHistory: string | null;
  accessionDate: string | null;
  status: string;
  priority: string | null;
}

export interface PathologistAssignment {
  identityId: string;
  displayName: string;
  role: 'PRIMARY' | 'SECONDARY' | 'CONSULTING' | 'RESIDENT' | 'FELLOW';
}

export interface ReportScaffold {
  case: CaseSummary;
  patient: PatientSummary | null;
  parts: PartData[];
  pathologists: PathologistAssignment[];
  reportState: ReportState;
  transmission: TransmissionRecord | null;
  caseComment?: string | null;
}

export interface TransmissionRecord {
  id: string;
  idempotencyKey: string;
  finalizedBy: string;
  finalizedAt: string;
  status: TransmissionStatus;
  hl7ErrorCode: string | null;
}

// ---------------------------------------------------------------------------
// Autosave (SDS 04-06 §8, SDS 04-01 §5)
// ---------------------------------------------------------------------------

export interface SavePartRequest {
  finalDiagnosis: string;
  metadata: PartMetadata;
}

export interface SavePartResponse {
  savedAt: string;
}

export interface SaveCaseCommentRequest {
  caseComment: string;
}

export interface SaveCaseCommentResponse {
  savedAt: string;
}

// ---------------------------------------------------------------------------
// Finalization (SDS 04-05 §5)
// ---------------------------------------------------------------------------

export interface FinalizeRequest {
  idempotencyKey: string;
  rtfPayload: string;
  versionHash: string;
}

// ---------------------------------------------------------------------------
// Conversational Authoring / LLM (SDS 04-03)
// ---------------------------------------------------------------------------

export type LlmActionType =
  | 'set_clauses'
  | 'add_clause'
  | 'remove_clause'
  | 'update_clause'
  | 'set_authored_label'
  | 'reorder_parts';

export interface LlmAction {
  type: LlmActionType;
  partLabel: string;
  payload: Record<string, unknown>;
  confidence: number;
  /**
   * Provenance stamp from the producing response. Added v2.7 so downstream
   * clause application can propagate source onto the produced clauses for
   * SDS 04-04 §4.1 visual provenance. `'rule'` for rules-engine actions,
   * `'ai_suggested'` for LLM-interpreter actions. Set by the consumer
   * (PromptArea) at the point of dispatch, not by the producers.
   */
  source?: import('../services/source-policy').ActionSource;
}

export interface Clarification {
  question: string;
  context: string;
  options?: string[];
}

export interface LlmInstructionRequest {
  instruction: string;
  caseContext: {
    caseId: string;
    parts: {
      partLabel: string;
      partDesignator: string | null;
      authoredLabel: string | null;
      anatomicSite: string | null;
      currentClauses: Clause[];
    }[];
    specimenType: string | null;
    clinicalHistory: string | null;
  };
  conversationHistory?: InstructionEntry[];
}

export interface LlmInstructionResponse {
  actions: LlmAction[];
  clarifications: Clarification[];
  confidence: number;
  summary: string;
  /**
   * Provenance of the response (SDS 04-03 §5.1, SRS-270). Drives automation
   * decisions through `source-policy.decidePolicy`: rules-engine results are
   * `'rule'` (auto-apply); LLM-interpreted results are `'ai_suggested'`
   * (always require explicit confirmation). Optional so existing mock test
   * fixtures don't have to be rewritten; the consumer defaults to `'rule'`
   * when unset to match the pre-v2.3 rules-only behavior.
   */
  source?: import('../services/source-policy').ActionSource;
}

export interface InstructionEntry {
  id: string;
  timestamp: string;
  source: 'typed' | 'voice';
  instruction: string;
  response: LlmInstructionResponse;
  applied: boolean;
}

// ---------------------------------------------------------------------------
// Save State Machine (SDS 04-01 §5.2)
// ---------------------------------------------------------------------------

export type SaveState = 'IDLE' | 'DIRTY' | 'SAVING' | 'SAVED' | 'ERROR' | 'DEGRADED';

// ---------------------------------------------------------------------------
// Clinical Context (SDS 04-01 §12, SRS-200–204)
// ---------------------------------------------------------------------------

export type ClinicalReportType =
  | 'OPERATIVE_NOTE'
  | 'ENDOSCOPY'
  | 'RADIOLOGY'
  | 'PRIOR_PATHOLOGY';

export type RelevanceFlag = 'PRIMARY' | 'SUPPORTING' | 'HISTORICAL' | 'IRRELEVANT';

/**
 * A clinical report from the EHR/LIS.
 * Body is RTF text — rendered by the existing RTF viewer.
 * The `summary` field is nullable: empty today, AI-populated later.
 */
export interface ClinicalReport {
  id: string;
  reportType: ClinicalReportType;
  reportDate: string;                 // ISO date
  sourceSystem: string;               // e.g. 'Epic', 'PowerChart'
  title: string;                      // Display label, e.g. "CT Abdomen/Pelvis"
  relevance: RelevanceFlag;           // Heuristic-assigned relevance
  summary: string | null;             // AI-generated one-liner, nullable
  body: string;                       // Full report text (RTF)
}

/**
 * Prior pathology case summary — richer than ClinicalReport because
 * it comes from our own system and we have structured data.
 */
export interface PriorPathologyCase {
  id: string;
  caseId: string;                     // e.g. "S25-1234"
  reportDate: string;
  specimenType: string;
  anatomicSite: string;
  diagnosisSummary: string;           // One-line extracted diagnosis
  relevance: RelevanceFlag;
  body: string;                       // Full report text
}

/**
 * Clinical context bundle — returned by GET /api/report/{caseId}/clinical.
 * Three collections of text-based reports plus prior pathology.
 */
export interface ClinicalContextBundle {
  caseId: string;
  patientMrn: string;
  surgicalNotes: ClinicalReport[];    // Operative notes, procedure notes
  radiologyReports: ClinicalReport[]; // Imaging studies
  priorPathology: PriorPathologyCase[];
}

// ---------------------------------------------------------------------------
// Report Edit Mode (Quick Entry vs Structured)
// ---------------------------------------------------------------------------

export type ReportEditMode = 'structured' | 'quick-entry';

// ---------------------------------------------------------------------------
// Mnemonic Search (MeiliSearch-backed, SRS §3.27+)
// ---------------------------------------------------------------------------

export interface MnemonicHit {
  mnemonicId: string;
  abbr: string;
  mnemonic: string;
  description: string | null;
  lookupDisplay: string | null;
  commentText: string;            // RTF content
  texttypeId: string;
  userUseCount?: number;
  // Governance (UN-097)
  tier?: 'personal' | 'institutional' | 'seed';
  retired?: boolean;
  createdBy?: string | null;
}

export interface MnemonicSearchResponse {
  hits: MnemonicHit[];
  totalHits: number;
  processingTimeMs: number;
}
