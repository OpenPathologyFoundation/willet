// Save Store — autosave state machine
// SDS 04-01 §5.2

import type { SaveState } from '$lib/types';

const DEBOUNCE_MS = 300;
const RETRY_DELAYS = [2000, 4000, 8000];

class SaveStore {
  state = $state<SaveState>('IDLE');
  lastSavedAt = $state<string | null>(null);
  retryCount = $state(0);

  // Internal — not exposed as reactive
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: (() => Promise<void>) | null = null;

  /** Mark a part as dirty — starts the debounce timer */
  markDirty(saveFn: () => Promise<void>): void {
    this.pendingSave = saveFn;

    if (this.state === 'SAVING') {
      // Queue the save for after current one completes
      return;
    }

    this.state = 'DIRTY';

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.executeSave(), DEBOUNCE_MS);
  }

  private async executeSave(): Promise<void> {
    const saveFn = this.pendingSave;
    if (!saveFn) return;

    this.pendingSave = null;
    this.state = 'SAVING';

    try {
      await saveFn();
      this.state = 'SAVED';
      this.lastSavedAt = new Date().toISOString();
      this.retryCount = 0;

      // If another change queued while saving, fire again
      if (this.pendingSave) {
        this.state = 'DIRTY';
        this.debounceTimer = setTimeout(() => this.executeSave(), DEBOUNCE_MS);
      }
    } catch (err: unknown) {
      const status = (err as any)?.status;

      // Non-retriable errors
      if (status === 401 || status === 409 || status === 423) {
        this.state = 'ERROR';
        return;
      }

      // Retriable (network error, 5xx)
      if (this.retryCount < RETRY_DELAYS.length) {
        this.state = 'ERROR';
        const delay = RETRY_DELAYS[this.retryCount];
        this.retryCount++;
        this.pendingSave = saveFn;
        this.debounceTimer = setTimeout(() => this.executeSave(), delay);
      } else {
        this.state = 'DEGRADED';
        // Keep the save function so recovery is possible
        this.pendingSave = saveFn;
      }
    }
  }

  /** Flush any pending save immediately (used on unmount) */
  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingSave) {
      await this.executeSave();
    }
  }

  reset(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
    this.pendingSave = null;
    this.state = 'IDLE';
    this.lastSavedAt = null;
    this.retryCount = 0;
  }
}

export const saveStore = new SaveStore();
