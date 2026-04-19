// Voice Store — focus tracking, recording state, dictation routing
// SDS 04-03 §14, §14.4, SRS-180 through SRS-184, SRS-281
//
// Dictation target model: instead of scattered boolean flags, a single
// typed target describes WHERE dictated text should be inserted.

import type { ClauseType } from '$lib/types';

/**
 * Maximum single-dictation duration (SRS-281 / SDS 04-03 §14.4).
 * Caller (PromptArea) auto-stops the MediaRecorder when this elapses so
 * runaway sessions don't exhaust STT quotas or memory. 5 minutes covers
 * any realistic single dictation; pathologists who need more can
 * immediately begin another recording.
 */
export const MAX_RECORDING_MS = 5 * 60 * 1000;

/**
 * Time before the cap at which the warning state activates, giving the
 * pathologist a chance to wrap up the current thought.
 */
export const RECORDING_WARNING_MS = 30 * 1000;

// ---------------------------------------------------------------------------
// Dictation Target — a discriminated union describing the active input target
// ---------------------------------------------------------------------------

export interface ClauseTarget {
  kind: 'clause';
  partId: string;
  partLabel: string;
  clauseIndex: number;
  clauseType: ClauseType;
}

export interface CaseCommentTarget {
  kind: 'case-comment';
}

export interface QuickEntryTarget {
  kind: 'quick-entry';
}

export interface ConversationalTarget {
  kind: 'conversational';
}

/** All possible dictation targets. */
export type DictationTarget =
  | ClauseTarget
  | CaseCommentTarget
  | QuickEntryTarget
  | ConversationalTarget;

/** Legacy alias — callers that only need clause focus data. */
export type FocusedClause = ClauseTarget;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

class VoiceStore {
  // The current real-time focus target (tracks which input has focus NOW)
  currentTarget = $state<DictationTarget | null>(null);

  // Recording state
  isRecording = $state(false);
  isTranscribing = $state(false);

  /**
   * True during the final 30 s of a recording (SRS-281). Consumers (e.g.,
   * `DictationIndicator`) surface a visible warning so the pathologist knows
   * auto-stop is imminent. Cleared on recording stop.
   */
  recordingWarning = $state(false);

  // Snapshot: locked-in target captured synchronously at mic press,
  // preserved across the entire recording + transcription duration.
  private _snapshot = $state<DictationTarget | null>(null);

  // Focus management with 150ms debounce (SRS-182)
  private blurTimeout: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------

  /** The snapshotted dictation target, set at recording start. */
  get snapshot(): DictationTarget | null {
    return this._snapshot;
  }

  /** Dictation indicator label for the UI. */
  get modeLabel(): string {
    if (!this.isRecording) return '';

    const target = this.currentTarget;
    if (!target) return 'Conversational mode';

    switch (target.kind) {
      case 'clause':
        return `Dictating into Part ${target.partLabel} · ${CLAUSE_LABELS[target.clauseType]}`;
      case 'case-comment':
        return 'Dictating into Case Comment';
      case 'quick-entry':
        return 'Dictating into Quick Entry';
      case 'conversational':
        return 'Conversational mode';
    }
  }

  /** Legacy getter — returns ClauseTarget if current target is a clause, null otherwise. */
  get lastFocusedClause(): FocusedClause | null {
    return this.currentTarget?.kind === 'clause' ? this.currentTarget : null;
  }

  get isDictatingIntoClause(): boolean {
    return this.isRecording && this.currentTarget?.kind === 'clause';
  }

  // ---------------------------------------------------------------------------
  // Focus management
  // ---------------------------------------------------------------------------

  /** Set focus to a specific clause in a part editor. */
  setFocus(clause: { partId: string; partLabel: string; clauseIndex: number; clauseType: ClauseType }): void {
    this.cancelPendingBlur();
    this.currentTarget = { kind: 'clause', ...clause };
  }

  /** Set focus to the case comment editor. */
  setCaseCommentFocus(): void {
    this.cancelPendingBlur();
    this.currentTarget = { kind: 'case-comment' };
  }

  /** Set focus to the quick entry RTF editor. */
  setQuickEntryFocus(): void {
    this.cancelPendingBlur();
    this.currentTarget = { kind: 'quick-entry' };
  }

  /** Clear focus with 150ms debounce to tolerate transitions (e.g., clause → clause). */
  clearFocus(): void {
    this.blurTimeout = setTimeout(() => {
      this.currentTarget = null;
      this.blurTimeout = null;
    }, 150);
  }

  /** Legacy alias for clearFocus — case comment and quick entry use the same debounce. */
  clearCaseCommentFocus(): void {
    this.clearFocus();
  }

  // ---------------------------------------------------------------------------
  // Snapshot management (for dictation)
  // ---------------------------------------------------------------------------

  /**
   * Capture focus snapshot synchronously at mic press — BEFORE any async work
   * (getUserMedia, etc.) that might let the blur debounce fire.
   * Returns the snapshotted target for immediate use.
   */
  snapshotFocusForDictation(): DictationTarget | null {
    this.cancelPendingBlur();
    this._snapshot = this.currentTarget ?? { kind: 'conversational' };
    return this._snapshot;
  }

  /** Clear the snapshot after dictation routing is complete. */
  clearDictationSnapshot(): void {
    this._snapshot = null;
  }

  /** @deprecated — use snapshot.kind checks instead. */
  get dictationSnapshot(): FocusedClause | null {
    if (this._snapshot?.kind !== 'clause') return null;
    return this._snapshot;
  }

  /** @deprecated — use snapshot.kind checks instead. */
  get caseCommentDictationSnapshot(): boolean {
    return this._snapshot?.kind === 'case-comment' || this._snapshot?.kind === 'quick-entry' || false;
  }

  // ---------------------------------------------------------------------------
  // Recording state
  // ---------------------------------------------------------------------------

  setRecording(recording: boolean): void {
    this.isRecording = recording;
    if (!recording) {
      // Clear the SRS-281 warning state on any transition to not-recording
      // (explicit stop, auto-stop, or error).
      this.recordingWarning = false;
    }
  }

  setRecordingWarning(active: boolean): void {
    this.recordingWarning = active;
  }

  setTranscribing(transcribing: boolean): void {
    this.isTranscribing = transcribing;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  reset(): void {
    this.cancelPendingBlur();
    this.currentTarget = null;
    this._snapshot = null;
    this.isRecording = false;
    this.isTranscribing = false;
    this.recordingWarning = false;
  }

  private cancelPendingBlur(): void {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
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
