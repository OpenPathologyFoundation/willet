<!-- PromptArea — compact bottom-anchored conversational input -->
<!-- SDS 04-03 §2.3, Design Dialogue Part IX -->
<script lang="ts">
  import type {
    LlmInstructionRequest,
    LlmInstructionResponse,
    LlmAction,
    InstructionEntry,
    ClauseType,
  } from '$lib/types';
  import { reportStore, parseClauses } from '$lib/stores/report.svelte';
  import { promptStore } from '$lib/stores/prompt.svelte';
  import { voiceStore, type FocusedClause, type DictationTarget, type ClauseTarget } from '$lib/stores/voice.svelte';
  import { getServices } from '$lib/services/context';
  import { transcribe } from '$lib/services/whisper';
  import { correctTranscription, type CorrectionResult } from '$lib/services/transcription-correction';
  import { normalizeFindingSingular } from '$lib/services/instruction-classifier';
  import { decidePolicy } from '$lib/services/source-policy';
  import PipelineProgress from './PipelineProgress.svelte';
  import type { PipelineStage } from './PipelineProgress.svelte';

  interface Props {
    caseId: string;
    onaction: (actions: LlmAction[]) => void;
    /** Clause-level dictation: raw + corrected text routed to a specific clause. */
    ondictation?: (text: string, correctedText: string, target: FocusedClause, corrections: CorrectionResult['corrections']) => void;
    /** Free-text dictation: corrected text routed to case comment or quick entry. */
    onfreetextdictation?: (text: string, targetKind: 'case-comment' | 'quick-entry') => void;
  }

  let { caseId, onaction, ondictation, onfreetextdictation }: Props = $props();

  const services = getServices();

  let inputText = $state('');
  let textareaEl = $state<HTMLTextAreaElement | null>(null);
  let logExpanded = $state(false);
  let expandedEntryId = $state<string | null>(null);

  // --- Context menu for instruction re-application ---
  const CLAUSE_TYPE_LABELS: { type: ClauseType; label: string }[] = [
    { type: 'DIAGNOSIS', label: 'Diagnosis' },
    { type: 'MARGIN', label: 'Margin' },
    { type: 'ANCILLARY', label: 'Ancillary' },
    { type: 'COMMENT', label: 'Comment' },
    { type: 'SYNOPTIC_REF', label: 'Synoptic' },
  ];
  let contextMenu = $state<{ x: number; y: number; entry: InstructionEntry } | null>(null);

  function handleEntryContextMenu(e: MouseEvent, entry: InstructionEntry) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, entry };
  }

  function closeContextMenu() {
    contextMenu = null;
  }

  function applyAsClauseType(clauseType: ClauseType) {
    if (!contextMenu) return;
    const entry = contextMenu.entry;
    closeContextMenu();

    // Target the focused part, or fall back to first part
    const focusedClause = voiceStore.lastFocusedClause;
    const targetLabel = focusedClause?.partLabel
      ?? reportStore.parts[0]?.partLabel;
    if (!targetLabel) return;

    // Extract the instruction text — use it directly as clause text
    let text = entry.instruction.trim();
    text = text.charAt(0).toUpperCase() + text.slice(1);

    const action: LlmAction = {
      type: 'add_clause',
      partLabel: targetLabel,
      payload: { clause: { text, type: clauseType } },
      confidence: 1.0,
    };
    onaction([action]);
  }

  // Voice recording state
  let isRecording = $state(false);
  let isTranscribing = $state(false);
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphoneStream: MediaStream | null = null;
  let animationFrameId = 0;
  let audioLevels = $state<number[]>(new Array(5).fill(4));
  let voiceError = $state<string | null>(null);

  // Track the element that had focus when recording started (for focus restoration)
  let preDictationFocusEl = $state<HTMLElement | null>(null);

  // MCP server availability indicator
  let mcpAvailable = $state<boolean | null>(null); // null = unknown, true/false = checked

  // Brief correction indicator for the conversational path (SRS-186)
  let correctionNotice = $state<string | null>(null);
  let correctionNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  // Pipeline progress indicator
  let pipelineStages = $state<PipelineStage[]>([]);
  let pipelineTimer: ReturnType<typeof setTimeout> | null = null;

  function setPipeline(stages: PipelineStage[]) {
    pipelineStages = stages;
    // Auto-clear after 3 seconds of all-done
    if (pipelineTimer) clearTimeout(pipelineTimer);
    if (stages.every(s => s.status === 'done' || s.status === 'error')) {
      pipelineTimer = setTimeout(() => { pipelineStages = []; }, 2500);
    }
  }

  function updateStage(id: string, status: PipelineStage['status']) {
    pipelineStages = pipelineStages.map(s => s.id === id ? { ...s, status } : s);
    // Check if all done
    if (pipelineStages.every(s => s.status === 'done' || s.status === 'error')) {
      if (pipelineTimer) clearTimeout(pipelineTimer);
      pipelineTimer = setTimeout(() => { pipelineStages = []; }, 2500);
    }
  }

  // Pending confirmation surfaced for any non-`auto_apply` source decision (SDS 04-03
  // §5.1, SRS-270). Primarily used for `'ai_suggested'` LLM actions which, per v2.3,
  // never auto-apply regardless of confidence — judgment must stay in the loop.
  let pendingConfirmation = $state<{
    instruction: string;
    response: LlmInstructionResponse;
  } | null>(null);

  // --- Text input ---

  async function handleSubmit() {
    const instruction = inputText.trim();
    if (!instruction || promptStore.isProcessing) return;

    inputText = '';
    if (textareaEl) {
      textareaEl.style.height = 'auto';
    }
    promptStore.setProcessing();

    // Initialize instruction pipeline progress
    setPipeline([
      { id: 'rules', label: 'Rules engine', icon: 'pencil', status: 'active' },
      { id: 'llm', label: 'AI model', icon: 'brain', status: 'pending' },
      { id: 'apply', label: 'Applying', icon: 'check', status: 'pending' },
    ]);

    const request: LlmInstructionRequest = {
      instruction,
      caseContext: {
        caseId,
        parts: reportStore.parts.map((p) => ({
          partLabel: p.partLabel,
          partDesignator: p.partDesignator,
          authoredLabel: p.metadata.authored_label ?? null,
          anatomicSite: p.anatomicSite,
          currentClauses: parseClauses(p),
        })),
        specimenType: reportStore.caseData?.specimenType ?? null,
        clinicalHistory: reportStore.caseData?.clinicalHistory ?? null,
      },
      conversationHistory: promptStore.history,
    };

    try {
      let response: LlmInstructionResponse = await services.api.sendInstruction(caseId, request);
      // Tag the rules-engine response as `source: 'rule'` so downstream automation
      // decisions flow through the source-based policy (SDS §5.1, SRS-270) rather
      // than a numeric threshold. If the LLM path takes over below, the response
      // gets retagged `'ai_suggested'`.
      response = { ...response, source: 'rule' };

      // Escalation: when the rules engine returns no actions, try the real LLM (SDS §4).
      // Under v2.3, routing-to-LLM is a structural decision (did the deterministic
      // path find anything?), not a numeric-confidence decision. Whatever the LLM
      // returns will be marked `'ai_suggested'` and therefore require confirmation;
      // the rules engine's own confidence number no longer gates escalation.
      const shouldEscalate = response.actions.length === 0;
      updateStage('rules', 'done');
      if (shouldEscalate) {
        updateStage('llm', 'active');
        try {
          const llmResult = await services.api.interpretInstruction(
            instruction, request.caseContext, promptStore.history,
          );
          // The LLM returns actions directly — use them if available
          const llmActions = (llmResult as Record<string, unknown>).actions as LlmAction[] | undefined;
          const llmConfidence = (llmResult as Record<string, unknown>).confidence as number | undefined;
          const llmSummary = (llmResult as Record<string, unknown>).summary as string | undefined;

          if (llmActions && llmActions.length > 0) {
            mcpAvailable = true;
            // Normalize singular forms when distributing findings across parts
            // (each part gets ONE finding: "polyps" → "polyp")
            if (llmActions.length > 1) {
              for (const a of llmActions) {
                if (a.type === 'set_clauses') {
                  const p = a.payload as { clauses: Array<{ text: string; type: string }> };
                  for (const c of p.clauses) {
                    c.text = normalizeFindingSingular(c.text);
                  }
                }
              }
            }
            response = {
              actions: llmActions,
              clarifications: ((llmResult as Record<string, unknown>).clarifications as typeof response.clarifications) ?? [],
              confidence: Math.max(llmConfidence ?? 0.85, 0.85),
              summary: (llmSummary ?? 'LLM-assisted') + ' (LLM)',
              source: 'ai_suggested',
            };
          } else {
            mcpAvailable = true; // Server responded, but no actions
          }
        } catch {
          // MCP server unavailable — proceed with rules engine result
          mcpAvailable = false;
        }
      }

      updateStage('llm', 'done');
      updateStage('apply', 'active');

      if (response.clarifications.length > 0) {
        promptStore.setClarification(response.clarifications[0]);
      }

      // Source-based policy gates (SDS 04-03 §5.1, SRS-270 — replaces the v2.2 numeric
      // 0.8/0.5 thresholds). The outcome depends on provenance: `'rule'` → auto-apply,
      // `'ai_suggested'` → always require confirmation (System 2 in the loop), per
      // the v2.3 design principle that probabilistic sources never act without judgment.
      const decision = decidePolicy(response.source ?? 'rule');

      if (response.actions.length === 0) {
        // No actions — entry records the instruction but nothing applies.
        const entry: InstructionEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'typed',
          instruction,
          response,
          applied: false,
        };
        promptStore.addEntry(entry);
      } else if (decision === 'auto_apply') {
        const entry: InstructionEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'typed',
          instruction,
          response,
          applied: true,
        };
        promptStore.addEntry(entry);
        onaction(response.actions);
      } else {
        // `'confirm' | 'always_confirm' | 'clarify'` all require explicit confirmation.
        const entry: InstructionEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          source: 'typed',
          instruction,
          response,
          applied: false,
        };
        promptStore.addEntry(entry);
        pendingConfirmation = { instruction, response };
      }

      updateStage('apply', 'done');
      promptStore.setIdle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process instruction';
      // Mark current active stage as error
      const activeStageId = pipelineStages.find(s => s.status === 'active')?.id;
      if (activeStageId) updateStage(activeStageId, 'error');

      if (message.includes('503')) {
        promptStore.setUnavailable();
      } else {
        promptStore.setError(message);
      }

      promptStore.addEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'typed',
        instruction,
        response: { actions: [], clarifications: [], confidence: 0, summary: 'Error: ' + message },
        applied: false,
      });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTextareaInput() {
    if (!textareaEl) return;
    textareaEl.style.height = 'auto';
    textareaEl.style.height = Math.min(240, textareaEl.scrollHeight) + 'px';
  }

  // --- Dictation routing ---

  /**
   * Route transcribed text to the correct target based on the focus snapshot.
   * This is the single decision point for all dictation — no scattered if/else chains.
   */
  function routeDictation(
    target: DictationTarget | null,
    rawText: string,
    correctedText: string,
    corrections: CorrectionResult['corrections'],
  ) {
    if (!target) target = { kind: 'conversational' };

    switch (target.kind) {
      case 'clause':
        // Direct dictation into a specific clause (SRS-180, SRS-181)
        ondictation?.(rawText, correctedText, target, corrections);
        break;

      case 'case-comment':
        // Insert into case comment editor (SRS-260)
        onfreetextdictation?.(correctedText, 'case-comment');
        break;

      case 'quick-entry':
        // Insert into quick entry RTF editor
        onfreetextdictation?.(correctedText, 'quick-entry');
        break;

      case 'conversational':
        // Fallback: put text in the prompt input for conversational processing
        inputText = (inputText ? inputText + ' ' : '') + correctedText;
        handleTextareaInput();
        break;
    }
  }

  // --- Voice recording (Whisper) ---

  function updateVisualizer() {
    if (!analyser || !isRecording) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    const step = Math.floor(dataArray.length / 5);
    const levels: number[] = [];
    for (let i = 0; i < 5; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
      levels.push(Math.max(4, (sum / step / 255) * 28));
    }
    audioLevels = levels;
    animationFrameId = requestAnimationFrame(updateVisualizer);
  }

  /**
   * Capture focus snapshot on pointerdown — BEFORE the blur event fires.
   * Browser event order: pointerdown → blur → mousedown → mouseup → click.
   * If we waited for click (inside startRecording), a slow mouse press
   * (>150ms hold) would let the blur debounce fire and null out the focus.
   * (SDS 04-03 §14.1, §16.5)
   */
  function captureSnapshotEarly() {
    voiceStore.snapshotFocusForDictation();
  }

  /**
   * Global keyboard shortcut: Cmd+L (Mac) or Ctrl+L (Win/Linux).
   * Toggles dictation without moving focus. Because the cursor stays in the clause
   * textarea, there's no blur/snapshot timing issue — the focus is always captured
   * correctly. This also maps to foot pedals that emit keyboard shortcuts.
   * (SRS-196)
   */
  function handleGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'l' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      if (isRecording) {
        stopRecording();
      } else if (!isTranscribing && !promptStore.isProcessing) {
        // Capture which element currently has focus so we can restore it after recording
        preDictationFocusEl = document.activeElement as HTMLElement | null;
        // Snapshot focus — cursor is still in the clause field, so this always works
        voiceStore.snapshotFocusForDictation();
        startRecording();
      }
    }
  }

  async function startRecording() {
    if (isRecording) return;
    voiceError = null;
    // Snapshot was already captured on pointerdown (captureSnapshotEarly).
    // If somehow missed (e.g., keyboard activation), capture now as fallback.
    if (!voiceStore.dictationSnapshot) {
      voiceStore.snapshotFocusForDictation();
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStream = stream;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        microphoneStream?.getTracks().forEach((t) => t.stop());
        if (audioContext?.state !== 'closed') audioContext?.close();
        cancelAnimationFrame(animationFrameId);
        audioLevels = new Array(5).fill(4);

        // Snapshot was captured synchronously when mic was clicked (SDS 04-03 §14.1)

        // Initialize voice pipeline progress
        setPipeline([
          { id: 'transcribe', label: 'Transcribing', icon: 'mic', status: 'active' },
          { id: 'correct', label: 'Correcting', icon: 'pencil', status: 'pending' },
          { id: 'route', label: 'Inserting', icon: 'arrow', status: 'pending' },
        ]);

        isTranscribing = true;
        voiceStore.setTranscribing(true);
        const result = await transcribe(blob);
        isTranscribing = false;
        voiceStore.setTranscribing(false);

        if (result.error) {
          voiceError = result.error;
          updateStage('transcribe', 'error');
        } else if (result.text) {
          updateStage('transcribe', 'done');
          updateStage('correct', 'active');

          // Apply transcription correction (SRS-185) — both paths get corrected text
          // Try MCP server API first, fall back to local deterministic table (SDS §8 graceful degradation)
          const specimenType = reportStore.caseData?.specimenType ?? null;
          let correction: CorrectionResult;
          try {
            const apiResult = await services.api.correctTranscription(result.text, specimenType);
            correction = {
              text: apiResult.corrected,
              corrected: apiResult.changes.length > 0,
              corrections: apiResult.changes.map(c => ({
                original: c.original,
                replacement: c.corrected,
                start: c.position,
              })),
            };
          } catch {
            // API unavailable — fall back to local correction
            correction = correctTranscription(result.text, specimenType);
          }
          const correctedText = correction.text;

          updateStage('correct', 'done');
          updateStage('route', 'active');

          // Route dictated text based on the snapshot target captured at mic press
          routeDictation(voiceStore.snapshot, result.text, correctedText, correction.corrections);

          updateStage('route', 'done');

          // Show brief correction notice for either path (SRS-186)
          if (correction.corrected) {
            const count = correction.corrections.length;
            const examples = correction.corrections.slice(0, 2)
              .map(c => `"${c.original}" → "${c.replacement}"`).join(', ');
            correctionNotice = `${count} correction${count !== 1 ? 's' : ''}: ${examples}`;
            if (correctionNoticeTimer) clearTimeout(correctionNoticeTimer);
            correctionNoticeTimer = setTimeout(() => { correctionNotice = null; }, 2000);
          }
          // Clear the snapshot after routing is complete
          voiceStore.clearDictationSnapshot();

          // Restore focus to where the user was before recording (so Enter works immediately)
          const wasConversational = voiceStore.snapshot?.kind === 'conversational';
          if (preDictationFocusEl) {
            requestAnimationFrame(() => {
              preDictationFocusEl?.focus();
              preDictationFocusEl = null;
            });
          } else if (wasConversational) {
            // Conversational path: focus the prompt textarea so Enter submits
            requestAnimationFrame(() => textareaEl?.focus());
          }
        }
      };
      mediaRecorder.start();
      isRecording = true;
      voiceStore.setRecording(true);
      updateVisualizer();
    } catch {
      voiceError = 'Microphone access denied';
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    isRecording = false;
    voiceStore.setRecording(false);
  }

  function confirmPending() {
    if (!pendingConfirmation) return;
    const { response } = pendingConfirmation;
    // Mark the last history entry as applied
    const lastEntry = promptStore.history[promptStore.history.length - 1];
    if (lastEntry && !lastEntry.applied) {
      lastEntry.applied = true;
    }
    onaction(response.actions);
    pendingConfirmation = null;
  }

  function dismissPending() {
    pendingConfirmation = null;
  }

  function dismissClarification() {
    promptStore.setClarification(null);
  }

  function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '...' : text;
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="border-t border-clinical-border bg-clinical-surface" onclick={closeContextMenu}>
  <!-- Instruction log (compact, collapsible) -->
  {#if promptStore.history.length > 0}
    <div class="border-b border-clinical-border">
      <button
        class="flex w-full items-center gap-1.5 px-4 py-1 text-[10px] text-clinical-muted hover:text-clinical-text-secondary transition-colors"
        onclick={() => { logExpanded = !logExpanded; }}
      >
        <svg
          class="h-3 w-3 shrink-0 transition-transform {logExpanded ? 'rotate-90' : ''}"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span>{promptStore.history.length} instruction{promptStore.history.length !== 1 ? 's' : ''}</span>
      </button>

      {#if logExpanded}
        <div class="max-h-32 overflow-auto px-4 pb-1.5">
          {#each promptStore.history as entry (entry.id)}
            {@const isDetailOpen = expandedEntryId === entry.id}
            <button
              type="button"
              class="group/entry w-full text-left py-0.5 cursor-pointer hover:bg-clinical-hover/50 rounded -mx-1 px-1"
              onclick={() => { expandedEntryId = isDetailOpen ? null : entry.id; }}
              oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
            >
              <div class="flex items-center gap-1.5 text-[11px]">
                {#if entry.source === 'voice'}
                  <svg class="h-2.5 w-2.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                {:else}
                  <span class="text-clinical-muted shrink-0">&rsaquo;</span>
                {/if}
                <span class="text-clinical-text-secondary truncate flex-1">&ldquo;{truncate(entry.instruction, 40)}&rdquo;</span>
                <span class="shrink-0 {entry.applied ? 'text-badge-green-text' : 'text-clinical-muted'}">
                  &rarr; {entry.response.summary}
                </span>
                <!-- Retry button — copies instruction to prompt input -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <span
                  class="shrink-0 opacity-0 group-hover/entry:opacity-100 text-clinical-muted hover:text-clinical-primary transition-all cursor-pointer"
                  role="button"
                  tabindex="-1"
                  title="Re-use this instruction"
                  onclick={(e) => { e.stopPropagation(); inputText = entry.instruction; handleTextareaInput(); textareaEl?.focus(); }}
                >
                  <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </span>
              </div>

              {#if isDetailOpen}
                <div class="mt-1 ml-4 text-[10px] text-clinical-muted space-y-0.5 pb-1">
                  <p><span class="text-clinical-text-secondary">Full:</span> {entry.instruction}</p>
                  {#if entry.response.actions.length > 0}
                    <p>{entry.response.actions.length} action{entry.response.actions.length !== 1 ? 's' : ''} {entry.applied ? 'applied' : 'suggested'}</p>
                  {/if}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Pending clarification -->
  {#if promptStore.pendingClarification}
    <div class="border-b border-clinical-border bg-badge-amber-bg/20 px-4 py-1.5">
      <div class="flex items-start gap-2">
        <span class="mt-0.5 text-badge-amber-text text-xs font-medium">?</span>
        <div class="flex-1">
          <p class="text-xs text-clinical-text">{promptStore.pendingClarification.question}</p>
          {#if promptStore.pendingClarification.options}
            <div class="mt-1 flex flex-wrap gap-1">
              {#each promptStore.pendingClarification.options as option}
                <button
                  class="rounded border border-clinical-border bg-clinical-surface px-2 py-0.5 text-[10px] text-clinical-text-secondary hover:border-clinical-primary/50"
                  onclick={() => { inputText = option; dismissClarification(); }}
                >{option}</button>
              {/each}
            </div>
          {/if}
        </div>
        <button class="text-clinical-muted hover:text-clinical-text text-xs" onclick={dismissClarification}>&times;</button>
      </div>
    </div>
  {/if}

  <!-- Pending confirmation for medium-confidence actions (SDS §5.1) -->
  {#if pendingConfirmation}
    <div class="border-b border-clinical-border bg-badge-amber-bg/10 px-4 py-2">
      <div class="flex items-start gap-2">
        <span class="mt-0.5 text-badge-amber-text text-xs font-medium shrink-0">?</span>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-clinical-text">{pendingConfirmation.response.summary}</p>
          <p class="text-[10px] text-clinical-muted mt-0.5">
            Confidence: {Math.round(pendingConfirmation.response.confidence * 100)}% &mdash;
            {pendingConfirmation.response.actions.length} action{pendingConfirmation.response.actions.length !== 1 ? 's' : ''}
          </p>
          <div class="mt-1.5 flex gap-2">
            <button
              class="rounded bg-clinical-primary px-3 py-0.5 text-[11px] font-medium text-white hover:bg-clinical-primary/90 transition-colors"
              onclick={confirmPending}
            >Apply</button>
            <button
              class="rounded border border-clinical-border px-3 py-0.5 text-[11px] text-clinical-muted hover:text-clinical-text hover:border-clinical-text/30 transition-colors"
              onclick={dismissPending}
            >Dismiss</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Status / voice error -->
  {#if promptStore.status === 'unavailable'}
    <div class="border-b border-clinical-border px-4 py-1 text-[10px] text-badge-amber-text">AI service unavailable — manual editing only</div>
  {:else if promptStore.status === 'error'}
    <div class="border-b border-clinical-border px-4 py-1 text-[10px] text-badge-rose-text">{promptStore.errorMessage}</div>
  {/if}
  {#if voiceError}
    <div class="border-b border-clinical-border px-4 py-1 text-[10px] text-badge-rose-text flex justify-between">
      <span>{voiceError}</span>
      <button class="text-clinical-muted hover:text-clinical-text" onclick={() => { voiceError = null; }}>&times;</button>
    </div>
  {/if}
  {#if correctionNotice}
    <div class="border-b border-clinical-border px-4 py-1 text-[10px] text-badge-sky-text bg-badge-sky-bg/20 transition-opacity">
      {correctionNotice}
    </div>
  {/if}

  <!-- Pipeline progress indicator -->
  {#if pipelineStages.length > 0}
    <PipelineProgress stages={pipelineStages} />
  {/if}

  <!-- MCP server status (shown after first escalation attempt) -->
  {#if mcpAvailable === false}
    <div class="border-b border-clinical-border px-4 py-1 text-[10px] text-badge-amber-text bg-badge-amber-bg/10 flex items-center gap-1.5">
      <span class="h-1.5 w-1.5 rounded-full bg-badge-amber-text/70 shrink-0"></span>
      LLM server offline — complex instructions use local rules only. Start with: <code class="mx-1 px-1 bg-clinical-hover rounded text-[9px]">cd mcp-server && python3 server.py</code>
    </div>
  {/if}

  <!-- Input row -->
  <div class="flex items-end gap-2 px-4 py-2">
    {#if isRecording}
      <!-- Recording visualizer inline -->
      <div class="flex flex-1 items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-1.5">
        <span class="h-2 w-2 shrink-0 rounded-full bg-amber-500 animate-pulse"></span>
        <div class="flex items-center gap-0.5 flex-1 justify-center">
          {#each audioLevels as height}
            <div class="w-1 rounded-full bg-amber-500 transition-all duration-75" style="height:{height}px;opacity:{0.4+(height/28)*0.6}"></div>
          {/each}
        </div>
        <span class="text-[10px] text-amber-500">Listening...</span>
        <span class="text-[9px] text-amber-500/60 hidden sm:inline">Cmd+L</span>
        <button
          type="button"
          class="shrink-0 rounded bg-amber-500 p-1 text-white hover:bg-amber-600"
          onclick={stopRecording}
          title="Stop (or Cmd+L)"
        >
          <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
      </div>
    {:else}
      <!-- Textarea with mic + send inside -->
      <div class="flex flex-1 items-end rounded-md border border-clinical-border bg-clinical-bg focus-within:border-clinical-primary/50 focus-within:ring-1 focus-within:ring-clinical-primary/30 transition-colors">
        <textarea
          bind:this={textareaEl}
          bind:value={inputText}
          onkeydown={handleKeydown}
          oninput={handleTextareaInput}
          disabled={promptStore.status === 'unavailable'}
          rows={1}
          class="flex-1 resize-none bg-transparent px-3 py-1.5 text-sm text-clinical-text placeholder-clinical-muted outline-none disabled:text-clinical-muted disabled:cursor-not-allowed"
          placeholder="Describe findings or give instructions..."
        ></textarea>

        <!-- Mic button (inside field) -->
        <!-- pointerdown captures focus snapshot BEFORE blur fires on the clause textarea -->
        <button
          type="button"
          class="shrink-0 p-1.5 text-clinical-muted hover:text-amber-500 transition-colors disabled:opacity-50"
          onpointerdown={captureSnapshotEarly}
          onclick={startRecording}
          disabled={isTranscribing || promptStore.isProcessing}
          title="Dictate (or Cmd+L from any field)"
        >
          {#if isTranscribing}
            <span class="block h-4 w-4 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500"></span>
          {:else}
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          {/if}
        </button>

        <!-- Send button (inside field) -->
        <button
          type="button"
          class="shrink-0 p-1.5 text-clinical-primary hover:text-clinical-primary/80 transition-colors disabled:opacity-30"
          onclick={handleSubmit}
          disabled={!inputText.trim() || promptStore.isProcessing}
          title="Send (Enter)"
        >
          {#if promptStore.isProcessing}
            <span class="block h-4 w-4 animate-spin rounded-full border-2 border-clinical-primary/30 border-t-clinical-primary"></span>
          {:else}
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          {/if}
        </button>
      </div>
    {/if}
  </div>

  <!-- Right-click context menu for re-applying instructions -->
  {#if contextMenu}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-50"
      onclick={closeContextMenu}
      oncontextmenu={(e) => { e.preventDefault(); closeContextMenu(); }}
    >
      <div
        class="absolute rounded border border-clinical-border bg-clinical-surface shadow-lg py-1 min-w-[180px]"
        style="left:{contextMenu.x}px;top:{contextMenu.y}px;"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="px-3 py-1 text-[10px] text-clinical-muted border-b border-clinical-border mb-0.5">
          Apply as...
        </div>
        {#each CLAUSE_TYPE_LABELS as { type, label }}
          <button
            type="button"
            class="w-full text-left px-3 py-1 text-xs text-clinical-text hover:bg-clinical-hover/70 transition-colors"
            onclick={() => applyAsClauseType(type)}
          >
            {label}
          </button>
        {/each}
        <div class="border-t border-clinical-border mt-0.5 pt-0.5">
          <button
            type="button"
            class="w-full text-left px-3 py-1 text-xs text-clinical-muted hover:bg-clinical-hover/70 transition-colors"
            onclick={() => { if (contextMenu) { inputText = contextMenu.entry.instruction; closeContextMenu(); } }}
          >
            Copy to input
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
