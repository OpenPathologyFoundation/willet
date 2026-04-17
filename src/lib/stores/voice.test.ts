import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { voiceStore } from './voice.svelte';

describe('voiceStore', () => {
  beforeEach(() => {
    voiceStore.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with null focus and not recording', () => {
    expect(voiceStore.lastFocusedClause).toBeNull();
    expect(voiceStore.isRecording).toBe(false);
    expect(voiceStore.isTranscribing).toBe(false);
  });

  it('setFocus sets the focused clause', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    expect(voiceStore.lastFocusedClause).toMatchObject({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
  });

  it('clearFocus debounces by 150ms', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    voiceStore.clearFocus();
    // Still focused after 100ms
    vi.advanceTimersByTime(100);
    expect(voiceStore.lastFocusedClause).not.toBeNull();
    // Cleared after 150ms total
    vi.advanceTimersByTime(50);
    expect(voiceStore.lastFocusedClause).toBeNull();
  });

  it('setFocus cancels pending clearFocus', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    voiceStore.clearFocus();
    vi.advanceTimersByTime(100);
    // Re-focus before debounce completes
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 1,
      clauseType: 'MARGIN',
    });
    vi.advanceTimersByTime(200);
    expect(voiceStore.lastFocusedClause?.clauseIndex).toBe(1);
  });

  it('modeLabel shows clause target when recording with focus', () => {
    voiceStore.setFocus({
      partId: 'part-b',
      partLabel: 'B',
      clauseIndex: 0,
      clauseType: 'MARGIN',
    });
    voiceStore.setRecording(true);
    expect(voiceStore.modeLabel).toBe('Dictating into Part B · Margin');
  });

  it('modeLabel shows conversational when recording without focus', () => {
    voiceStore.setRecording(true);
    expect(voiceStore.modeLabel).toBe('Conversational mode');
  });

  it('modeLabel is empty when not recording', () => {
    expect(voiceStore.modeLabel).toBe('');
  });

  it('isDictatingIntoClause is true only when recording with focus', () => {
    expect(voiceStore.isDictatingIntoClause).toBe(false);
    voiceStore.setRecording(true);
    expect(voiceStore.isDictatingIntoClause).toBe(false);
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    expect(voiceStore.isDictatingIntoClause).toBe(true);
  });

  it('reset clears all state', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    voiceStore.setRecording(true);
    voiceStore.setTranscribing(true);
    voiceStore.reset();
    expect(voiceStore.lastFocusedClause).toBeNull();
    expect(voiceStore.isRecording).toBe(false);
    expect(voiceStore.isTranscribing).toBe(false);
  });

  // --- Snapshot tests (focus preservation during recording) ---

  it('snapshotFocusForDictation captures current focus', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    const snapshot = voiceStore.snapshotFocusForDictation();
    expect(snapshot).toEqual({
      kind: 'clause',
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    expect(voiceStore.dictationSnapshot).toMatchObject({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
  });

  it('snapshot survives blur debounce expiring', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    voiceStore.snapshotFocusForDictation();
    // Simulate blur from clicking mic button
    voiceStore.clearFocus();
    // Let debounce expire (simulates recording duration >> 150ms)
    vi.advanceTimersByTime(5000);
    // lastFocusedClause is cleared, but snapshot survives
    expect(voiceStore.lastFocusedClause).toBeNull();
    expect(voiceStore.dictationSnapshot).not.toBeNull();
    expect(voiceStore.dictationSnapshot?.clauseType).toBe('DIAGNOSIS');
  });

  it('snapshotFocusForDictation cancels pending blur', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    // Start a blur
    voiceStore.clearFocus();
    vi.advanceTimersByTime(100); // partial debounce
    // Snapshot while blur is pending — should cancel the blur
    voiceStore.snapshotFocusForDictation();
    vi.advanceTimersByTime(200); // past the original debounce
    // Focus should still be set (blur was cancelled by snapshot)
    expect(voiceStore.lastFocusedClause).not.toBeNull();
  });

  it('snapshot defaults to conversational when no clause was focused', () => {
    const snapshot = voiceStore.snapshotFocusForDictation();
    expect(snapshot).toEqual({ kind: 'conversational' });
    // Legacy getter still returns null for clause-specific snapshot
    expect(voiceStore.dictationSnapshot).toBeNull();
  });

  it('clearDictationSnapshot resets the snapshot', () => {
    voiceStore.setFocus({
      partId: 'part-a',
      partLabel: 'A',
      clauseIndex: 0,
      clauseType: 'DIAGNOSIS',
    });
    voiceStore.snapshotFocusForDictation();
    expect(voiceStore.dictationSnapshot).not.toBeNull();
    voiceStore.clearDictationSnapshot();
    expect(voiceStore.dictationSnapshot).toBeNull();
  });
});
