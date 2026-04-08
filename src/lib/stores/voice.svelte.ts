// Voice Store — focus tracking, recording state, dictation routing
// SDS 04-03 §14, SRS-180 through SRS-184

import type { ClauseType } from '$lib/types';

export interface FocusedClause {
  partId: string;
  partLabel: string;
  clauseIndex: number;
  clauseType: ClauseType;
}

class VoiceStore {
  // Focus tracking (SRS-182)
  lastFocusedClause = $state<FocusedClause | null>(null);

  // Recording state
  isRecording = $state(false);
  isTranscribing = $state(false);

  // Dictation indicator (SRS-184)
  get dictationTarget(): FocusedClause | null {
    return this.isRecording ? this.lastFocusedClause : null;
  }

  get isDictatingIntoClause(): boolean {
    return this.isRecording && this.lastFocusedClause !== null;
  }

  get modeLabel(): string {
    if (!this.isRecording) return '';
    if (this.lastFocusedClause) {
      const { partLabel, clauseType } = this.lastFocusedClause;
      return `Dictating into Part ${partLabel} · ${CLAUSE_LABELS[clauseType]}`;
    }
    return 'Conversational mode';
  }

  // Focus management with 150ms debounce (SRS-182)
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;

  setFocus(clause: FocusedClause): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this.lastFocusedClause = clause;
  }

  /**
   * Snapshot the current focus target. Call this synchronously when the mic
   * button is clicked — before any async work (getUserMedia, etc.) that
   * might allow the blur debounce to fire and clear the focus.
   */
  snapshotFocusForDictation(): FocusedClause | null {
    // Cancel any pending blur so it doesn't clear during recording
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this._dictationSnapshot = this.lastFocusedClause;
    return this._dictationSnapshot;
  }

  /** The snapshotted focus target, preserved across recording duration. */
  private _dictationSnapshot: FocusedClause | null = null;

  get dictationSnapshot(): FocusedClause | null {
    return this._dictationSnapshot;
  }

  clearDictationSnapshot(): void {
    this._dictationSnapshot = null;
  }

  clearFocus(): void {
    // Debounce blur by 150ms to tolerate focus transitions (e.g., clause → clause)
    this.blurTimeout = setTimeout(() => {
      this.lastFocusedClause = null;
      this.blurTimeout = null;
    }, 150);
  }

  setRecording(recording: boolean): void {
    this.isRecording = recording;
  }

  setTranscribing(transcribing: boolean): void {
    this.isTranscribing = transcribing;
  }

  reset(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    this.lastFocusedClause = null;
    this.isRecording = false;
    this.isTranscribing = false;
  }
}

const CLAUSE_LABELS: Record<ClauseType, string> = {
  DIAGNOSIS: 'Diagnosis',
  MARGIN: 'Margin',
  ANCILLARY: 'Ancillary',
  SYNOPTIC_REF: 'Synoptic',
  COMMENT: 'Comment',
};

export const voiceStore = new VoiceStore();
