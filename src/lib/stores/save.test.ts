// Unit tests — autosave state machine
// SDS 04-01 §5.2

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the SaveStore class by importing the module.
// Since it uses Svelte 5 $state runes, we need the svelte compiler to process it.
// Vitest with the svelte plugin handles this.

// However, $state is a compiler transform — in plain test context we test
// the state machine logic by exercising the public API and checking transitions.

describe('SaveStore state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in IDLE state', async () => {
    // Dynamic import to get a fresh module instance
    const { saveStore } = await import('./save.svelte');
    expect(saveStore.state).toBe('IDLE');
    saveStore.reset();
  });

  it('transitions to DIRTY then SAVING on markDirty', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const saveFn = vi.fn().mockResolvedValue(undefined);
    saveStore.markDirty(saveFn);

    expect(saveStore.state).toBe('DIRTY');

    // Advance past debounce (300ms)
    await vi.advanceTimersByTimeAsync(350);

    expect(saveFn).toHaveBeenCalledOnce();
    saveStore.reset();
  });

  it('transitions to SAVED after successful save', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const saveFn = vi.fn().mockResolvedValue(undefined);
    saveStore.markDirty(saveFn);

    await vi.advanceTimersByTimeAsync(350);

    expect(saveStore.state).toBe('SAVED');
    expect(saveStore.lastSavedAt).not.toBeNull();
    saveStore.reset();
  });

  it('transitions to ERROR on non-retriable failure (401)', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const err = new Error('Unauthorized');
    (err as any).status = 401;
    const saveFn = vi.fn().mockRejectedValue(err);
    saveStore.markDirty(saveFn);

    await vi.advanceTimersByTimeAsync(350);

    expect(saveStore.state).toBe('ERROR');
    saveStore.reset();
  });

  it('retries on retriable failure (500) with backoff', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    let callCount = 0;
    const saveFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        const err = new Error('Server error');
        (err as any).status = 500;
        return Promise.reject(err);
      }
      return Promise.resolve();
    });

    saveStore.markDirty(saveFn);
    // Debounce
    await vi.advanceTimersByTimeAsync(350);
    expect(callCount).toBe(1);
    expect(saveStore.retryCount).toBe(1);

    // First retry (2000ms)
    await vi.advanceTimersByTimeAsync(2100);
    expect(callCount).toBe(2);
    expect(saveStore.retryCount).toBe(2);

    // Second retry (4000ms) — this one succeeds
    await vi.advanceTimersByTimeAsync(4100);
    expect(callCount).toBe(3);
    expect(saveStore.state).toBe('SAVED');
    saveStore.reset();
  });

  it('transitions to DEGRADED after max retries', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const err = new Error('Network error');
    const saveFn = vi.fn().mockRejectedValue(err);

    saveStore.markDirty(saveFn);

    // Debounce + first attempt
    await vi.advanceTimersByTimeAsync(350);
    // Retry 1 (2s)
    await vi.advanceTimersByTimeAsync(2100);
    // Retry 2 (4s)
    await vi.advanceTimersByTimeAsync(4100);
    // Retry 3 (8s)
    await vi.advanceTimersByTimeAsync(8100);

    expect(saveStore.state).toBe('DEGRADED');
    saveStore.reset();
  });

  it('debounces rapid changes', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const saveFn1 = vi.fn().mockResolvedValue(undefined);
    const saveFn2 = vi.fn().mockResolvedValue(undefined);
    const saveFn3 = vi.fn().mockResolvedValue(undefined);

    saveStore.markDirty(saveFn1);
    await vi.advanceTimersByTimeAsync(100);
    saveStore.markDirty(saveFn2);
    await vi.advanceTimersByTimeAsync(100);
    saveStore.markDirty(saveFn3);

    // Only the last save function should execute
    await vi.advanceTimersByTimeAsync(350);

    expect(saveFn1).not.toHaveBeenCalled();
    expect(saveFn2).not.toHaveBeenCalled();
    expect(saveFn3).toHaveBeenCalledOnce();
    saveStore.reset();
  });

  it('flush executes pending save immediately', async () => {
    const { saveStore } = await import('./save.svelte');
    saveStore.reset();

    const saveFn = vi.fn().mockResolvedValue(undefined);
    saveStore.markDirty(saveFn);

    // Don't wait for debounce — flush immediately
    await saveStore.flush();

    expect(saveFn).toHaveBeenCalledOnce();
    expect(saveStore.state).toBe('SAVED');
    saveStore.reset();
  });

  it('reset clears all state', async () => {
    const { saveStore } = await import('./save.svelte');

    const saveFn = vi.fn().mockResolvedValue(undefined);
    saveStore.markDirty(saveFn);
    await vi.advanceTimersByTimeAsync(350);

    saveStore.reset();
    expect(saveStore.state).toBe('IDLE');
    expect(saveStore.lastSavedAt).toBeNull();
    expect(saveStore.retryCount).toBe(0);
  });
});
