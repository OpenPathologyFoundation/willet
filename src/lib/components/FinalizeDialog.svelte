<!-- FinalizeDialog — modal for finalization review and read-only view -->
<!-- SDS 04-05 §8 -->
<script lang="ts">
  import { InkEditor } from 'svelte-rtf-editor';

  interface Props {
    mode: 'finalize' | 'view';
    initialHtml: string;
    onconfirm?: (rtf: string) => void;
    oncancel?: () => void;
  }

  let { mode, initialHtml, onconfirm, oncancel }: Props = $props();

  let editor: InkEditor;
  let submitting = $state(false);
  let error = $state<string | null>(null);

  async function handleFinalize() {
    if (!editor || submitting) return;
    submitting = true;
    error = null;

    try {
      const rtf = editor.getRTF();
      onconfirm?.(rtf);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to extract RTF';
      submitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      oncancel?.();
    }
  }
</script>

<div
  class="finalize-overlay"
  role="dialog"
  aria-modal="true"
  aria-label={mode === 'finalize' ? 'Finalize report' : 'View formatted report'}
  tabindex="-1"
  onkeydown={handleKeydown}
>
  <div class="finalize-dialog">
    <!-- Header -->
    <div class="dialog-header">
      <h2>
        {#if mode === 'finalize'}
          Review formatted report before finalizing
        {:else}
          Formatted Report (Read-Only)
        {/if}
      </h2>
      <button class="close-btn" onclick={oncancel} aria-label="Close">
        &times;
      </button>
    </div>

    <!-- Editor area — always light background for readability -->
    <div class="dialog-body">
      <InkEditor
        bind:this={editor}
        content={initialHtml}
        readonly={mode === 'view'}
        showToolbar={mode === 'finalize'}
        showStatusBar={false}
        minHeight="300px"
      />
    </div>

    <!-- Error banner -->
    {#if error}
      <div class="error-banner">
        {error}
      </div>
    {/if}

    <!-- Footer actions -->
    <div class="dialog-footer">
      {#if mode === 'finalize'}
        <button class="btn btn-secondary" onclick={oncancel} disabled={submitting}>
          Cancel
        </button>
        <button class="btn btn-primary" onclick={handleFinalize} disabled={submitting}>
          {#if submitting}
            Finalizing...
          {:else}
            Finalize Report
          {/if}
        </button>
      {:else}
        <button class="btn btn-secondary" onclick={oncancel}>
          Close
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .finalize-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
  }

  .finalize-dialog {
    display: flex;
    flex-direction: column;
    width: 90vw;
    max-width: 56rem;
    max-height: 85vh;
    border-radius: 0.5rem;
    border: 1px solid var(--clinical-border);
    background-color: var(--clinical-surface);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--clinical-border);
  }

  .dialog-header h2 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--clinical-text);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--clinical-muted);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
  }
  .close-btn:hover {
    color: var(--clinical-text);
  }

  .dialog-body {
    flex: 1;
    overflow: auto;
    padding: 1rem 1.5rem;
    min-height: 300px;
    /* Force light background for the RTF editor content — clinical documents
       are always read on white, regardless of app theme */
    background-color: #FFFFFF;
    color: #111827;
    border-radius: 0.25rem;
    margin: 0.75rem 1.5rem;
    border: 1px solid var(--clinical-border);
  }

  .error-banner {
    margin: 0 1.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid var(--badge-rose-bg);
    background-color: var(--badge-rose-bg);
    color: var(--badge-rose-text);
    font-size: 0.75rem;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--clinical-border);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--clinical-surface-raised, var(--clinical-surface));
    color: var(--clinical-muted);
    border-color: var(--clinical-border);
  }
  .btn-secondary:hover:not(:disabled) {
    background-color: var(--clinical-hover);
  }

  .btn-primary {
    background-color: var(--clinical-primary);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background-color: var(--clinical-primary);
    filter: brightness(0.9);
  }
</style>
