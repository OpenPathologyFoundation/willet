// Report Store — holds the loaded scaffold and editable state
// SDS 04-01 §3.1, §4.4

import type {
  ReportScaffold,
  CaseSummary,
  PatientSummary,
  PartData,
  PathologistAssignment,
  ReportState,
  TransmissionRecord,
  Clause,
  ClauseType,
} from '$lib/types';

// ---------------------------------------------------------------------------
// Clause ↔ finalDiagnosis serialization (SDS 04-01 §4.4)
// ---------------------------------------------------------------------------

export function parseClauses(part: PartData): Clause[] {
  if (!part.finalDiagnosis) return [];

  const types = part.metadata.clause_types ?? [];
  const lines = part.finalDiagnosis.split('\n');

  // If we have clause_types metadata, use it to determine the exact clause count
  // (preserving empty clauses that the user just created via Enter).
  // Without metadata, filter empty lines for backward compatibility with
  // scaffold data that may have trailing newlines.
  const effectiveLines = types.length > 0
    ? lines.slice(0, Math.max(lines.length, types.length))
    : lines.filter((l) => l.length > 0);

  const sources = part.metadata.clause_sources ?? [];
  return effectiveLines.map((text, i) => ({
    text,
    type: types[i] ?? ('ANCILLARY' as ClauseType),
    confidence: part.metadata.confidence?.[i],
    source: sources[i],
  }));
}

export function serializeClauses(clauses: Clause[]): {
  finalDiagnosis: string;
  clause_types: ClauseType[];
  confidence: (number | undefined)[];
  clause_sources: (import('$lib/services/source-policy').ActionSource | undefined)[];
} {
  return {
    finalDiagnosis: clauses.map((c) => c.text).join('\n'),
    clause_types: clauses.map((c) => c.type),
    confidence: clauses.map((c) => c.confidence),
    clause_sources: clauses.map((c) => c.source),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

class ReportStore {
  // Reactive state
  loadState = $state<LoadState>('idle');
  error = $state<string | null>(null);

  caseData = $state<CaseSummary | null>(null);
  patient = $state<PatientSummary | null>(null);
  parts = $state<PartData[]>([]);
  pathologists = $state<PathologistAssignment[]>([]);
  reportState = $state<ReportState>('DRAFT');
  transmission = $state<TransmissionRecord | null>(null);
  caseComment = $state<string>('');

  // Derived
  isReadOnly = $derived(
    this.reportState === 'FINALIZED' || this.caseData?.status === 'archived',
  );
  isLoaded = $derived(this.loadState === 'loaded');
  caseId = $derived(this.caseData?.caseId ?? null);

  loadFromScaffold(scaffold: ReportScaffold): void {
    this.caseData = scaffold.case;
    this.patient = scaffold.patient;
    this.parts = scaffold.parts;
    this.pathologists = scaffold.pathologists;
    this.reportState = scaffold.reportState;
    this.transmission = scaffold.transmission;
    this.caseComment = scaffold.caseComment ?? '';
    this.loadState = 'loaded';
    this.error = null;
  }

  setError(message: string): void {
    this.error = message;
    this.loadState = 'error';
  }

  setLoading(): void {
    this.loadState = 'loading';
    this.error = null;
  }

  /** Update a part's finalDiagnosis and metadata after autosave round-trip */
  updatePart(partId: string, finalDiagnosis: string, metadata: Record<string, unknown>): void {
    const idx = this.parts.findIndex((p) => p.id === partId);
    if (idx === -1) return;

    // Svelte 5 fine-grained reactivity: mutate in place
    this.parts[idx] = {
      ...this.parts[idx],
      finalDiagnosis,
      metadata: { ...this.parts[idx].metadata, ...metadata },
    };
  }

  reorderParts(newOrder: PartData[]): void {
    this.parts = newOrder;
  }

  updateCaseComment(text: string): void {
    this.caseComment = text;
  }

  reset(): void {
    this.loadState = 'idle';
    this.error = null;
    this.caseData = null;
    this.patient = null;
    this.parts = [];
    this.pathologists = [];
    this.reportState = 'DRAFT';
    this.transmission = null;
    this.caseComment = '';
  }
}

export const reportStore = new ReportStore();
