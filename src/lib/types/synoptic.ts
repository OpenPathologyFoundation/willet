// Synoptic Protocol Types — ported from Clarion CAP Protocol app
// Adapted for WILLET with provenance tracking and Svelte 5 patterns

// ---------------------------------------------------------------------------
// Protocol Schema (from CAP protocol JSON definitions)
// ---------------------------------------------------------------------------

export type SynopticFieldType =
  | 'blank'
  | 'dropdown'
  | 'dropdown-count'
  | 'dropdown-size'
  | 'dropdown-distance'
  | 'dropdown-depth'
  | 'multiselect'
  | 'text'
  | 'list';

export interface SynopticSection {
  type: SynopticFieldType;
  caption?: string;
  suffix?: string;
  'additional caption'?: string;
  options?: string[];
}

/** A complete protocol definition, keyed by section title. */
export interface SynopticProtocol {
  [sectionTitle: string]: SynopticSection;
}

// ---------------------------------------------------------------------------
// Field Lifecycle State
// ---------------------------------------------------------------------------

export type FieldStatus = 'empty' | 'suggested' | 'applied' | 'edited';

/** Where a field value originated. */
export type FieldProvenance = 'clause' | 'clinical' | 'ai' | 'manual';

export interface SynopticFieldState {
  value: string;
  status: FieldStatus;
  provenance?: FieldProvenance;
  confidence?: number;        // 0.0–1.0 for suggested fields
  sourceText?: string;         // Raw text that generated this value
}

// ---------------------------------------------------------------------------
// Protocol Registry
// ---------------------------------------------------------------------------

export interface ProtocolRegistryEntry {
  file: string;               // JSON filename (without extension)
  label: string;              // Human-readable protocol name
  keywords: string[];         // Specimen type keywords for matching
}
