// Synoptic Store — protocol form state + field lifecycle management
// Ported from Clarion fieldStates.ts, adapted for Svelte 5 runes

import type {
  SynopticProtocol,
  SynopticFieldState,
  FieldStatus,
  FieldProvenance,
} from '$lib/types/synoptic';
import type { PartData, ClauseType, ClinicalContextBundle } from '$lib/types';
import { parseClauses } from '$lib/stores/report.svelte';

class SynopticStore {
  // Protocol definition
  protocol = $state<SynopticProtocol | null>(null);
  protocolLabel = $state('');

  // Field states keyed by section title
  fieldStates = $state<Record<string, SynopticFieldState>>({});

  // Accordion open/closed states
  accordionStates = $state<Record<string, boolean>>({});

  // Pending sync: fields that have new data but were skipped because
  // the user already edited/applied them. Shown as a badge on the sync button.
  pendingSyncData = $state<Record<string, { value: string; provenance: FieldProvenance; sourceText?: string }>>({});

  // Derived counts
  get sectionTitles(): string[] {
    if (!this.protocol) return [];
    return Object.keys(this.protocol).filter(k => this.protocol![k].type !== 'blank');
  }

  get totalCount(): number {
    return this.sectionTitles.length;
  }

  get filledCount(): number {
    return this.sectionTitles.filter(k => {
      const fs = this.fieldStates[k];
      return fs && fs.status !== 'empty' && fs.value.trim().length > 0;
    }).length;
  }

  get suggestedCount(): number {
    return this.sectionTitles.filter(k => this.fieldStates[k]?.status === 'suggested').length;
  }

  get appliedCount(): number {
    return this.sectionTitles.filter(k => this.fieldStates[k]?.status === 'applied').length;
  }

  get pendingSyncCount(): number {
    return Object.keys(this.pendingSyncData).length;
  }

  get isLoaded(): boolean {
    return this.protocol !== null;
  }

  // ---------------------------------------------------------------------------
  // Protocol lifecycle
  // ---------------------------------------------------------------------------

  loadProtocol(data: SynopticProtocol, label: string): void {
    this.protocol = data;
    this.protocolLabel = label;
    this.fieldStates = {};
    this.accordionStates = {};

    // Initialize field states for all non-blank sections
    for (const [title, section] of Object.entries(data)) {
      if (section.type !== 'blank') {
        this.fieldStates[title] = { value: '', status: 'empty' };
      }
    }
  }

  reset(): void {
    this.protocol = null;
    this.protocolLabel = '';
    this.fieldStates = {};
    this.accordionStates = {};
    this.pendingSyncData = {};
  }

  // ---------------------------------------------------------------------------
  // Field state management
  // ---------------------------------------------------------------------------

  setFieldValue(sectionTitle: string, value: string, provenance: FieldProvenance = 'manual'): void {
    this.fieldStates = {
      ...this.fieldStates,
      [sectionTitle]: {
        value,
        status: 'edited',
        provenance,
      },
    };
  }

  setSuggested(
    sectionTitle: string,
    value: string,
    confidence: number,
    provenance: FieldProvenance,
    sourceText?: string,
  ): void {
    const existing = this.fieldStates[sectionTitle];

    // Hybrid sync: don't overwrite manually edited or user-applied fields.
    // Instead, stash the new data in pendingSyncData for the manual re-sync button.
    if (existing?.status === 'edited' || existing?.status === 'applied') {
      // Only stash if the value is actually different
      if (existing.value !== value) {
        this.pendingSyncData = {
          ...this.pendingSyncData,
          [sectionTitle]: { value, provenance, sourceText },
        };
      }
      return;
    }

    // Auto-apply high confidence suggestions to empty/suggested fields
    const status: FieldStatus = confidence >= 0.9 ? 'applied' : 'suggested';

    this.fieldStates = {
      ...this.fieldStates,
      [sectionTitle]: { value, status, provenance, confidence, sourceText },
    };

    // Auto-expand sections with suggestions
    if (status === 'suggested') {
      this.accordionStates = { ...this.accordionStates, [sectionTitle]: true };
    }
  }

  applySuggestion(sectionTitle: string): void {
    const fs = this.fieldStates[sectionTitle];
    if (!fs || fs.status !== 'suggested') return;

    this.fieldStates = {
      ...this.fieldStates,
      [sectionTitle]: { ...fs, status: 'applied' },
    };
  }

  rejectSuggestion(sectionTitle: string): void {
    const fs = this.fieldStates[sectionTitle];
    if (!fs || fs.status !== 'suggested') return;

    this.fieldStates = {
      ...this.fieldStates,
      [sectionTitle]: { value: '', status: 'empty' },
    };
  }

  applyAllSuggestions(): void {
    const updated = { ...this.fieldStates };
    for (const [title, fs] of Object.entries(updated)) {
      if (fs.status === 'suggested') {
        updated[title] = { ...fs, status: 'applied' };
      }
    }
    this.fieldStates = updated;
  }

  rejectAllSuggestions(): void {
    const updated = { ...this.fieldStates };
    for (const [title, fs] of Object.entries(updated)) {
      if (fs.status === 'suggested') {
        updated[title] = { value: '', status: 'empty' };
      }
    }
    this.fieldStates = updated;
  }

  // Accordion
  toggleSection(sectionTitle: string): void {
    this.accordionStates = {
      ...this.accordionStates,
      [sectionTitle]: !this.accordionStates[sectionTitle],
    };
  }

  expandAll(): void {
    const states: Record<string, boolean> = {};
    for (const title of this.sectionTitles) {
      states[title] = true;
    }
    this.accordionStates = states;
  }

  collapseAll(): void {
    this.accordionStates = {};
  }

  // ---------------------------------------------------------------------------
  // Manual re-sync (applies pending data to edited/applied fields)
  // ---------------------------------------------------------------------------

  /**
   * Apply all pending sync data to their fields. Used by the manual re-sync button.
   * Returns the count of fields updated.
   */
  applyPendingSync(): number {
    let count = 0;
    const updated = { ...this.fieldStates };

    for (const [title, pending] of Object.entries(this.pendingSyncData)) {
      updated[title] = {
        value: pending.value,
        status: 'applied',
        provenance: pending.provenance,
        sourceText: pending.sourceText,
      };
      count++;
    }

    this.fieldStates = updated;
    this.pendingSyncData = {};
    return count;
  }

  /** Clear all pending sync data without applying. */
  dismissPendingSync(): void {
    this.pendingSyncData = {};
  }

  // ---------------------------------------------------------------------------
  // Clinical context → Synoptic population
  // ---------------------------------------------------------------------------

  /**
   * Extract molecular and ancillary data from clinical context (prior reports)
   * and populate matching synoptic fields. Runs after clause population.
   */
  populateFromClinicalContext(bundle: ClinicalContextBundle | null): void {
    if (!this.protocol || !bundle) return;

    // Scan prior pathology reports for molecular data
    for (const prior of bundle.priorPathology) {
      const body = prior.body.toLowerCase();

      // MSI / mismatch repair
      if (this.protocol['Microsatellite Instability (MSI)'] || this.protocol['Mismatch Repair']) {
        const msiField = this.protocol['Microsatellite Instability (MSI)']
          ? 'Microsatellite Instability (MSI)'
          : 'Mismatch Repair';

        if (body.includes('microsatellite stable') || body.includes('mss') || body.includes('mismatch repair proteins show intact')) {
          this.setSuggested(msiField, 'Stable (MSS)', 0.85, 'clinical', prior.body);
        } else if (body.includes('microsatellite instability-high') || body.includes('msi-h') || body.includes('msi-high')) {
          this.setSuggested(msiField, 'Instability-high (MSI-H)', 0.85, 'clinical', prior.body);
        }
      }

      // KRAS / NRAS / BRAF mutations (colon-specific)
      if (this.protocol['KRAS Mutation']) {
        if (body.includes('kras mutation detected') || body.includes('kras positive')) {
          this.setSuggested('KRAS Mutation', 'Mutation detected', 0.8, 'clinical', prior.body);
        } else if (body.includes('kras wild') || body.includes('kras negative') || body.includes('no kras mutation')) {
          this.setSuggested('KRAS Mutation', 'No mutation detected (wild type)', 0.8, 'clinical', prior.body);
        }
      }

      if (this.protocol['BRAF Mutation']) {
        if (body.includes('braf v600e') || body.includes('braf mutation detected')) {
          this.setSuggested('BRAF Mutation', 'Mutation detected (V600E)', 0.8, 'clinical', prior.body);
        } else if (body.includes('braf wild') || body.includes('no braf mutation')) {
          this.setSuggested('BRAF Mutation', 'No mutation detected', 0.8, 'clinical', prior.body);
        }
      }
    }

    // Scan surgical/procedure notes for relevant clinical data
    for (const note of bundle.surgicalNotes) {
      const body = note.body.toLowerCase();

      // Tumor size from operative notes
      if (this.protocol['Tumor Size']) {
        const sizeMatch = body.match(/(?:tumor|mass|lesion).*?(\d+(?:\.\d+)?)\s*(?:x\s*\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?)?)?\s*cm/i);
        if (sizeMatch) {
          this.setSuggested('Tumor Size', sizeMatch[0], 0.7, 'clinical', note.body);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Clause → Synoptic auto-population
  // ---------------------------------------------------------------------------

  /**
   * Extract structured values from report clauses and populate matching
   * synoptic fields. Uses rules-based pattern matching — no AI.
   */
  populateFromClauses(parts: PartData[]): void {
    if (!this.protocol) return;

    for (const part of parts) {
      const clauses = parseClauses(part);

      for (const clause of clauses) {
        const text = clause.text.toLowerCase();

        // Margin clauses → Margin-related synoptic fields
        if (clause.type === 'MARGIN') {
          this.extractMarginData(clause.text);
        }

        // Diagnosis clauses → Tumor type, grade, differentiation
        if (clause.type === 'DIAGNOSIS') {
          this.extractDiagnosisData(clause.text);
        }

        // Ancillary clauses → Lymph nodes, LVI, PNI
        if (clause.type === 'ANCILLARY') {
          this.extractAncillaryData(clause.text);
        }
      }
    }
  }

  private extractMarginData(text: string): void {
    const lower = text.toLowerCase();

    // Margin status
    if (this.protocol!['Margin Status'] || this.protocol!['Status of Margins']) {
      const marginField = this.protocol!['Margin Status'] ? 'Margin Status' : 'Status of Margins';
      if (lower.includes('uninvolved') || lower.includes('negative') || lower.includes('free')) {
        this.setSuggested(marginField, 'Uninvolved by invasive carcinoma', 0.95, 'clause', text);
      } else if (lower.includes('involved') || lower.includes('positive')) {
        this.setSuggested(marginField, 'Involved by invasive carcinoma', 0.95, 'clause', text);
      }
    }

    // Closest margin distance
    const distMatch = text.match(/(\d+(?:\.\d+)?)\s*mm/i);
    if (distMatch && (this.protocol!['Distance from Closest Margin'] || this.protocol!['Margin Distance'])) {
      const distField = this.protocol!['Distance from Closest Margin'] ? 'Distance from Closest Margin' : 'Margin Distance';
      this.setSuggested(distField, distMatch[1] + ' mm', 0.9, 'clause', text);
    }
  }

  private extractDiagnosisData(text: string): void {
    const lower = text.toLowerCase();

    // Histologic type
    if (this.protocol!['Histologic Type']) {
      if (lower.includes('adenocarcinoma')) {
        this.setSuggested('Histologic Type', 'Adenocarcinoma', 0.95, 'clause', text);
      } else if (lower.includes('squamous cell carcinoma')) {
        this.setSuggested('Histologic Type', 'Squamous cell carcinoma', 0.95, 'clause', text);
      }
    }

    // Grade / differentiation
    if (this.protocol!['Histologic Grade']) {
      if (lower.includes('well differentiated') || lower.includes('grade 1') || lower.includes('low grade')) {
        this.setSuggested('Histologic Grade', 'Well differentiated (low grade)', 0.9, 'clause', text);
      } else if (lower.includes('moderately differentiated') || lower.includes('grade 2')) {
        this.setSuggested('Histologic Grade', 'Moderately differentiated', 0.9, 'clause', text);
      } else if (lower.includes('poorly differentiated') || lower.includes('grade 3') || lower.includes('high grade')) {
        this.setSuggested('Histologic Grade', 'Poorly differentiated (high grade)', 0.9, 'clause', text);
      }
    }
  }

  private extractAncillaryData(text: string): void {
    const lower = text.toLowerCase();

    // Lymphovascular invasion
    if (this.protocol!['Lymphovascular Invasion']) {
      if (lower.includes('lymphovascular invasion identified') || lower.includes('lvi identified') || lower.includes('lvi present')) {
        this.setSuggested('Lymphovascular Invasion', 'Present', 0.9, 'clause', text);
      } else if (lower.includes('lymphovascular invasion not identified') || lower.includes('lvi not identified') || lower.includes('no lvi')) {
        this.setSuggested('Lymphovascular Invasion', 'Not identified', 0.9, 'clause', text);
      }
    }

    // Perineural invasion
    if (this.protocol!['Perineural Invasion']) {
      if (lower.includes('perineural invasion identified') || lower.includes('pni identified') || lower.includes('pni present')) {
        this.setSuggested('Perineural Invasion', 'Present', 0.9, 'clause', text);
      } else if (lower.includes('perineural invasion not identified') || lower.includes('pni not identified') || lower.includes('no pni') || lower.includes('no perineural')) {
        this.setSuggested('Perineural Invasion', 'Not identified', 0.9, 'clause', text);
      }
    }

    // Lymph node counts
    const lnMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*(?:positive|nodes)/i);
    if (lnMatch && this.protocol!['Number of Lymph Nodes Involved']) {
      this.setSuggested('Number of Lymph Nodes Involved', lnMatch[1], 0.85, 'clause', text);
    }
    if (lnMatch && this.protocol!['Number of Lymph Nodes Examined']) {
      this.setSuggested('Number of Lymph Nodes Examined', lnMatch[2], 0.85, 'clause', text);
    }
  }

  // ---------------------------------------------------------------------------
  // Output formatting (matches Clarion LiveReport format)
  // ---------------------------------------------------------------------------

  /** Generate formatted synoptic text from all filled fields (for clipboard / transmission). */
  getFormattedOutput(): string {
    if (!this.protocol) return '';

    const lines: string[] = [];
    for (const title of Object.keys(this.protocol)) {
      const section = this.protocol[title];
      if (section.type === 'blank') continue;

      const fs = this.fieldStates[title];
      if (fs && fs.value.trim().length > 0) {
        const cleanTitle = title.replace(/^\t\+/, '');
        // Uppercase values for clinical standardization (CAP convention)
        const value = fs.value.toUpperCase();
        // Ensure trailing period for clean sentence termination
        const terminated = value.endsWith('.') ? value : value + '.';
        lines.push(`${cleanTitle}: ${terminated}`);
      }
    }
    return lines.join('\n');
  }

  /** Get structured output sections for the live preview UI (with numbering). */
  getOutputSections(): { index: number; title: string; value: string }[] {
    if (!this.protocol) return [];

    const sections: { index: number; title: string; value: string }[] = [];
    let idx = 0;
    for (const title of Object.keys(this.protocol)) {
      const section = this.protocol[title];
      if (section.type === 'blank') continue;

      const fs = this.fieldStates[title];
      if (fs && fs.value.trim().length > 0) {
        const cleanTitle = title.replace(/^\t\+/, '');
        const value = fs.value.toUpperCase();
        const terminated = value.endsWith('.') ? value : value + '.';
        sections.push({ index: idx + 1, title: cleanTitle, value: terminated });
        idx++;
      }
    }
    return sections;
  }
}

export const synopticStore = new SynopticStore();
