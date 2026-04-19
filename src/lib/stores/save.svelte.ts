// Save Store — autosave state machine
// SDS 04-01 §5.2; autosave-toggle behavior per SRS-280

import type { SaveState } from '$lib/types';
import { preferencesStore } from './preferences.svelte';

const DEBOUNCE_MS = 300;
const RETRY_DELAYS = [2000, 4000, 8000];

class SaveStore {
  state = $state<SaveState>('IDLE');
  lastSavedAt = $state<string | null>(null);
  retryCount = $state(0);

  // Internal — not exposed as reactive
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: (() => Promise<void>) | null = null;

  /**
   * Mark a part as dirty. Starts the debounce timer when autosave is enabled
   * (default). When autosave is disabled (SRS-280), the pending save is
   * retained but not scheduled — the user must click the Save button, which
   * calls `saveNow()` to execute immediately.
   */
  markDirty(saveFn: () => Promise<void>): void {
    this.pendingSave = saveFn;

    if (this.state === 'SAVING') {
      // Queue the save for after current one completes.
      // On completion, executeSave re-checks the autosave preference before scheduling.
      return;
    }

    this.state = 'DIRTY';

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;

    if (!preferencesStore.autosave) {
      // Autosave off: hold DIRTY state until user clicks Save (saveNow()).
      return;
    }

    this.debounceTimer = setTimeout(() => this.executeSave(), DEBOUNCE_MS);
  }

  /**
   * Explicit save gesture, used by the manual Save button. Executes any
   * pending save immediately regardless of the autosave preference. When
   * nothing is pending, returns quietly.
   */
  async saveNow(): Promise<void> {
    await this.flush();
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

      // If another change queued while saving, fire again (or hold DIRTY if autosave off).
      if (this.pendingSave) {
        this.state = 'DIRTY';
        if (preferencesStore.autosave) {
          this.debounceTimer = setTimeout(() => this.executeSave(), DEBOUNCE_MS);
        }
      }
    } catch (err: unknown) {
      const status = err instanceof Error && 'status' in err ? (err as { status: number }).status : undefined;

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
