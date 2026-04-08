// Prompt Store — manages conversational authoring state
// SDS 04-03 §9

import type { InstructionEntry, Clarification } from '$lib/types';

type PromptStatus = 'idle' | 'processing' | 'error' | 'unavailable';

class PromptStore {
  status = $state<PromptStatus>('idle');
  history = $state<InstructionEntry[]>([]);
  pendingClarification = $state<Clarification | null>(null);
  errorMessage = $state<string | null>(null);

  get isProcessing(): boolean {
    return this.status === 'processing';
  }

  setProcessing() {
    this.status = 'processing';
    this.errorMessage = null;
  }

  setIdle() {
    this.status = 'idle';
  }

  setError(message: string) {
    this.status = 'error';
    this.errorMessage = message;
  }

  setUnavailable() {
    this.status = 'unavailable';
    this.errorMessage = 'AI service unavailable — manual editing only';
  }

  addEntry(entry: InstructionEntry) {
    this.history = [...this.history, entry];
  }

  setClarification(clarification: Clarification | null) {
    this.pendingClarification = clarification;
  }

  reset() {
    this.status = 'idle';
    this.history = [];
    this.pendingClarification = null;
    this.errorMessage = null;
  }
}

export const promptStore = new PromptStore();
