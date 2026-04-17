<!-- QuickEntryEditor — mnemonic search + RTF editor for rapid report authoring -->
<!-- Alternative to structured part-by-part editing -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { InkEditor, rtfToHtml } from 'svelte-rtf-editor';
  import type { MnemonicHit, PartData } from '$lib/types';
  import { getServices } from '$lib/services/context';
  import { voiceStore } from '$lib/stores/voice.svelte';
  import { saveStore } from '$lib/stores/save.svelte';
  import { reportStore, parseClauses } from '$lib/stores/report.svelte';
  import MnemonicSearch from './MnemonicSearch.svelte';
  import { texttypeLabel, texttypeBadgeColor } from '$lib/constants/texttype';

  interface Props {
    readOnly: boolean;
  }

  let { readOnly }: Props = $props();

  const services = getServices();

  let editor = $state<InkEditor | null>(null);
  let selectedHit = $state<MnemonicHit | null>(null);
  let topMnemonics = $state<MnemonicHit[]>([]);
  let searchRef = $state<MnemonicSearch | null>(null);

  /**
   * Build an HTML scaffold from the case's parts, preserving the authored labels
   * and any existing clause content. This gives the pathologist the same part
   * structure they'd see in structured mode, but in a free-text editor.
   */
  function buildPartScaffoldHtml(): string {
    const parts = reportStore.parts;
    if (parts.length === 0) return '';

    const sections: string[] = [];

    for (const part of parts) {
      const label = part.metadata.authored_label ?? part.partDesignator ?? '';
      const header = `<h3>Part ${escapeHtml(part.partLabel)}: ${escapeHtml(label)}</h3>`;

      // If clauses already exist (user started in structured mode), bring them in
      const clauses = parseClauses(part);
      if (clauses.length > 0) {
        const clauseHtml = clauses.map(c => `<p>${escapeHtml(c.text)}</p>`).join('\n');
        sections.push(`${header}\n${clauseHtml}`);
      } else {
        // Empty part — just header with a placeholder line
        sections.push(`${header}\n<p><br></p>`);
      }
    }

    return sections.join('\n');
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  onMount(async () => {
    // Load user's most-used mnemonics
    try {
      topMnemonics = await services.api.getTopMnemonics(5);
    } catch {
      // Not critical — just skip favorites
    }

    // Pre-populate editor with part headers from the case scaffold
    await tick(); // Wait for InkEditor to mount
    if (editor) {
      const scaffoldHtml = buildPartScaffoldHtml();
      if (scaffoldHtml) {
        editor.setHTML(scaffoldHtml);
      }
    }

    searchRef?.focus();
  });

  async function handleSelectMnemonic(hit: MnemonicHit) {
    selectedHit = hit;

    if (editor && hit.commentText) {
      // Parse the mnemonic RTF/text into HTML
      let html: string;
      try {
        html = rtfToHtml(hit.commentText);
      } catch {
        html = `<p>${escapeHtml(hit.commentText)}</p>`;
      }

      // Insert mnemonic content into the editor at the current cursor position.
      // If the editor has part scaffold content, append after the current content
      // rather than replacing everything.
      const currentHtml = editor.getHTML();
      const hasContent = currentHtml && currentHtml.replace(/<[^>]*>/g, '').trim().length > 0;

      if (hasContent) {
        // Append the mnemonic content after existing content
        // (preserves part headers and any prior content)
        const combined = currentHtml + html;
        editor.setHTML(combined);

        // Scroll to the bottom of the editor so the newly inserted content is visible
        requestAnimationFrame(() => {
          const editorEl = document.querySelector('.quick-entry-editor [contenteditable]');
          if (editorEl instanceof HTMLElement) {
            editorEl.focus();
            // Move cursor to end
            const selection = window.getSelection();
            if (selection) {
              selection.selectAllChildren(editorEl);
              selection.collapseToEnd();
            }
            editorEl.scrollTop = editorEl.scrollHeight;
          }
        });
      } else {
        // Empty editor — set full content
        editor.setHTML(html);
      }
    }

    // Record usage for ranking
    try {
      await services.api.recordMnemonicUsage(hit.mnemonicId);
    } catch {
      // Non-critical
    }
  }

  function handleClear() {
    selectedHit = null;
    // Re-populate with part scaffold (don't clear everything)
    if (editor) {
      const scaffoldHtml = buildPartScaffoldHtml();
      editor.setHTML(scaffoldHtml || '');
    }
    searchRef?.focus();
  }

  // Voice focus tracking — when the editor area is focused, route dictation here
  function handleEditorFocus() {
    voiceStore.setQuickEntryFocus();
  }

  function handleEditorBlur() {
    voiceStore.clearFocus();
  }

  /**
   * Get the current editor content as RTF (for finalization).
   */
  export function getRTF(): string {
    return editor?.getRTF() ?? '';
  }

  /**
   * Get the current editor content as HTML.
   */
  export function getHTML(): string {
    return editor?.getHTML() ?? '';
  }

  /**
   * Insert dictated text at the current cursor position.
   */
  export function insertDictation(text: string): void {
    if (!editor) return;
    // Focus the editor and insert at cursor
    const editorEl = document.querySelector('.quick-entry-editor .ink-editor-content');
    if (editorEl instanceof HTMLElement) {
      editorEl.focus();
      document.execCommand('insertText', false, text);
    }
  }
</script>

<div class="quick-entry-editor flex flex-1 flex-col overflow-hidden">
  <!-- Mnemonic search bar -->
  <div class="border-b border-clinical-border bg-clinical-surface px-4 py-3">
    <MnemonicSearch
      bind:this={searchRef}
      onselect={handleSelectMnemonic}
      selectedId={selectedHit?.mnemonicId ?? null}
    />

    <!-- Favorites chips -->
    {#if topMnemonics.length > 0 && !selectedHit}
      <div class="mt-2 flex items-center gap-1.5">
        <span class="text-[10px] text-clinical-muted shrink-0">Recent:</span>
        {#each topMnemonics as fav (fav.mnemonicId)}
          <button
            type="button"
            class="rounded-full border border-clinical-border bg-clinical-bg px-2 py-0.5 text-[10px] text-clinical-text-secondary transition-colors hover:border-clinical-primary/50 hover:text-clinical-text"
            onclick={() => handleSelectMnemonic(fav)}
          >
            {fav.abbr}
            {#if fav.lookupDisplay}
              <span class="text-clinical-muted"> {fav.lookupDisplay}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Selected mnemonic header -->
  {#if selectedHit}
    <div class="flex items-center gap-2 border-b border-clinical-border bg-clinical-surface/50 px-4 py-2">
      <span class="font-mono text-sm font-semibold text-clinical-text">{selectedHit.abbr}</span>
      {#if selectedHit.lookupDisplay}
        <span class="text-sm text-clinical-text-secondary">{selectedHit.lookupDisplay}</span>
      {/if}
      <span
        class="rounded px-1.5 py-0.5 text-[9px] font-medium text-white"
        style="background-color: {texttypeBadgeColor(selectedHit.texttypeId)}"
      >
        {texttypeLabel(selectedHit.texttypeId)}
      </span>
      {#if selectedHit.description}
        <span class="text-xs text-clinical-muted">{selectedHit.description}</span>
      {/if}
      <button
        type="button"
        class="ml-auto text-xs text-clinical-muted hover:text-clinical-text transition-colors"
        onclick={handleClear}
      >
        Clear
      </button>
    </div>
  {/if}

  <!-- RTF Editor -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex-1 overflow-auto bg-white p-4"
    onfocusin={handleEditorFocus}
    onfocusout={handleEditorBlur}
  >
    {#if readOnly}
      <InkEditor
        bind:this={editor}
        readonly={true}
        showToolbar={false}
        autosave={false}
      />
    {:else}
      <InkEditor
        bind:this={editor}
        readonly={false}
        showToolbar={true}
        autosave={false}
      />
    {/if}

    {#if !selectedHit && !readOnly && reportStore.parts.length === 0}
      <div class="mt-4 text-center text-sm text-clinical-muted">
        Search for a mnemonic above to load a template, or start typing directly.
      </div>
    {/if}
  </div>
</div>
