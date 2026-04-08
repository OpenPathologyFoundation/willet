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

  const lines = part.finalDiagnosis.split('\n').filter((l) => l.length > 0);
  const types = part.metadata.clause_types ?? [];

  return lines.map((text, i) => ({
    text,
    type: types[i] ?? ('ANCILLARY' as ClauseType),
    confidence: part.metadata.confidence?.[i],
  }));
}

export function serializeClauses(clauses: Clause[]): {
  finalDiagnosis: string;
  clause_types: ClauseType[];
  confidence: (number | undefined)[];
} {
  return {
    finalDiagnosis: clauses.map((c) => c.text).join('\n'),
    clause_types: clauses.map((c) => c.type),
    confidence: clauses.map((c) => c.confidence),
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

  reset(): void {
    this.loadState = 'idle';
    this.error = null;
    this.caseData = null;
    this.patient = null;
    this.parts = [];
    this.pathologists = [];
    this.reportState = 'DRAFT';
    this.transmission = null;
  }
}

export const reportStore = new ReportStore();
