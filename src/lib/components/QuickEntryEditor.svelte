<!-- QuickEntryEditor — free-text RTF authoring surface for rapid report entry -->
<!-- Mnemonic governance (create/edit/retire/promote) lives in the right-side -->
<!-- Tools tab (UN-097); mnemonic INSERTION uses the Cmd+M popover. -->
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { InkEditor } from 'svelte-rtf-editor';
  import { voiceStore } from '$lib/stores/voice.svelte';
  import { reportStore, parseClauses } from '$lib/stores/report.svelte';

  interface Props {
    readOnly: boolean;
  }

  let { readOnly }: Props = $props();

  let editor = $state<InkEditor | null>(null);

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

      const clauses = parseClauses(part);
      if (clauses.length > 0) {
        const clauseHtml = clauses.map((c) => `<p>${escapeHtml(c.text)}</p>`).join('\n');
        sections.push(`${header}\n${clauseHtml}`);
      } else {
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
    await tick();
    if (editor) {
      const scaffoldHtml = buildPartScaffoldHtml();
      if (scaffoldHtml) {
        editor.setHTML(scaffoldHtml);
      }
    }
  });

  // Voice focus tracking — when the editor area is focused, route dictation here.
  function handleEditorFocus() {
    voiceStore.setQuickEntryFocus();
  }

  function handleEditorBlur() {
    voiceStore.clearFocus();
  }

  /** Get the current editor content as RTF (for finalization). */
  export function getRTF(): string {
    return editor?.getRTF() ?? '';
  }

  /** Get the current editor content as HTML. */
  export function getHTML(): string {
    return editor?.getHTML() ?? '';
  }

  /**
   * Insert dictated text at the current cursor position inside the RTF editor.
   * The InkEditor's contenteditable surface carries class `ink-content`
   * (see node_modules/svelte-rtf-editor InkEditor.svelte). Previous code
   * queried for `.ink-editor-content`, which silently matched nothing and
   * dropped the dictation on the floor.
   */
  export function insertDictation(text: string): void {
    if (!editor) return;
    const editorEl = document.querySelector<HTMLElement>('.quick-entry-editor .ink-content');
    if (!editorEl) return;
    editorEl.focus();
    // If the editor has never had focus, `getSelection()` may return a
    // collapsed range outside the editor. Place the caret at the end before
    // inserting so the text lands inside the editor regardless.
    const selection = window.getSelection();
    if (selection && (!editorEl.contains(selection.anchorNode))) {
      const range = document.createRange();
      range.selectNodeContents(editorEl);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand('insertText', false, text);
  }
</script>

<div class="quick-entry-editor flex flex-1 flex-col overflow-hidden">
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

    {#if !readOnly && reportStore.parts.length === 0}
      <div class="mt-4 text-center text-sm text-clinical-muted">
        Start typing directly, or press <kbd class="rounded border border-clinical-border bg-clinical-bg px-1 py-0.5 font-mono text-xs">⌘M</kbd>
        to insert a mnemonic. Manage mnemonics in the <strong>Tools</strong> tab.
      </div>
    {/if}
  </div>
</div>
