<!-- SynopticField — dynamic field renderer for CAP protocol sections -->
<!-- Ported from Clarion FormField.svelte, adapted for WILLET design system -->
<script lang="ts">
  import type { SynopticSection } from '$lib/types/synoptic';
  import { synopticStore } from '$lib/stores/synoptic.svelte';
  import FieldStatusBadge from './FieldStatusBadge.svelte';

  interface Props {
    sectionTitle: string;
    section: SynopticSection;
    readOnly: boolean;
  }

  let { sectionTitle, section, readOnly }: Props = $props();

  const fieldState = $derived(synopticStore.fieldStates[sectionTitle]);
  const displayTitle = $derived(sectionTitle.replace(/^\t\+/, ''));
  const isSubField = $derived(sectionTitle.startsWith('\t+'));

  // Local input state — initialized from field state
  let selectedValue = $state(fieldState?.value ?? '');
  let textInput = $state(fieldState?.value ?? '');
  let multiValues = $state<string[]>([]);
  let additionalInput = $state('');

  // Sync from store when field state changes externally (e.g., auto-population)
  $effect(() => {
    const fs = synopticStore.fieldStates[sectionTitle];
    if (fs && fs.status !== 'empty') {
      if (section.type === 'multiselect') {
        multiValues = fs.value.split(', ').filter(v => v.length > 0);
      } else if (section.type === 'text' || section.type === 'list') {
        textInput = fs.value;
      } else {
        selectedValue = fs.value;
      }
    }
  });

  function handleDropdownChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    selectedValue = value;
    commitValue(value);
  }

  function handleTextInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    textInput = value;
    commitValue(value);
  }

  function handleMultiselectToggle(option: string, checked: boolean) {
    if (checked) {
      multiValues = [...multiValues, option];
    } else {
      multiValues = multiValues.filter(v => v !== option);
    }
    commitValue(multiValues.join(', '));
  }

  function commitValue(value: string) {
    synopticStore.setFieldValue(sectionTitle, value, 'manual');
  }

  function handleApply() {
    synopticStore.applySuggestion(sectionTitle);
  }

  function handleReject() {
    synopticStore.rejectSuggestion(sectionTitle);
    selectedValue = '';
    textInput = '';
    multiValues = [];
  }

  // Check if a dropdown option needs additional text input
  function needsAdditionalInput(value: string): boolean {
    const lower = value.toLowerCase();
    return lower.includes('specify') || lower.includes('explain') || lower.includes('other');
  }
</script>

{#if section.type === 'blank'}
  <!-- Spacer / section divider -->
  <div class="my-1 border-t border-clinical-border/50"></div>

{:else}
  <div class="group {isSubField ? 'ml-4 border-l-2 border-clinical-border/30 pl-4' : ''}">
    <!-- Field header row -->
    <div class="flex items-center gap-2 py-1.5">
      <FieldStatusBadge
        status={fieldState?.status ?? 'empty'}
        provenance={fieldState?.provenance}
        confidence={fieldState?.confidence}
        onapply={handleApply}
        onreject={handleReject}
      />
      <span class="text-sm font-medium text-clinical-text-secondary flex-1 min-w-0 truncate" title={displayTitle}>
        {displayTitle}
      </span>
    </div>

    <!-- Caption -->
    {#if section.caption}
      <p class="text-xs text-clinical-muted mb-1.5 {isSubField ? '' : 'ml-7'}">{section.caption}</p>
    {/if}

    <!-- Field input -->
    <div class="ml-7">
      {#if section.type === 'dropdown' || section.type === 'dropdown-count' || section.type === 'dropdown-size' || section.type === 'dropdown-distance' || section.type === 'dropdown-depth'}
        <!-- Dropdown field -->
        <select
          class="w-full rounded border border-clinical-border bg-clinical-bg px-2.5 py-1.5 text-sm text-clinical-text outline-none transition-colors focus:border-clinical-primary/50 focus:ring-1 focus:ring-clinical-primary/30 disabled:cursor-not-allowed disabled:text-clinical-muted"
          value={selectedValue}
          onchange={handleDropdownChange}
          disabled={readOnly}
        >
          <option value="">-- Select --</option>
          {#each section.options ?? [] as option}
            <option value={option}>{option}</option>
          {/each}
        </select>

        <!-- Additional input for "Specify" / "Explain" options -->
        {#if selectedValue && needsAdditionalInput(selectedValue)}
          <input
            type="text"
            class="mt-1 w-full rounded border border-clinical-border bg-clinical-bg px-2.5 py-1.5 text-sm text-clinical-text outline-none focus:border-clinical-primary/50"
            placeholder="Please specify..."
            value={additionalInput}
            oninput={(e) => { additionalInput = (e.target as HTMLInputElement).value; commitValue(`${selectedValue}: ${additionalInput}`); }}
            disabled={readOnly}
          />
        {/if}

        <!-- Numeric input for count/size/distance/depth variants -->
        {#if section.type !== 'dropdown' && selectedValue}
          <div class="mt-1 flex items-center gap-1">
            <input
              type="text"
              class="w-20 rounded border border-clinical-border bg-clinical-bg px-2.5 py-1.5 text-sm text-clinical-text outline-none focus:border-clinical-primary/50"
              placeholder="Value"
              oninput={(e) => { const v = (e.target as HTMLInputElement).value; commitValue(`${selectedValue} ${v}${section.suffix ? ' ' + section.suffix : ''}`); }}
              disabled={readOnly}
            />
            {#if section.suffix}
              <span class="text-xs text-clinical-muted">{section.suffix}</span>
            {/if}
          </div>
        {/if}

      {:else if section.type === 'multiselect'}
        <!-- Multiselect checkboxes (compact) -->
        <div class="space-y-0.5">
          {#each section.options ?? [] as option}
            <label class="flex items-center gap-2 text-sm text-clinical-text cursor-pointer hover:text-clinical-primary transition-colors py-0.5">
              <input
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-clinical-border text-clinical-primary focus:ring-clinical-primary/30"
                checked={multiValues.includes(option)}
                onchange={(e) => handleMultiselectToggle(option, (e.target as HTMLInputElement).checked)}
                disabled={readOnly}
              />
              <span class="truncate">{option}</span>
            </label>
          {/each}
        </div>

      {:else if section.type === 'text' || section.type === 'list'}
        <!-- Text input -->
        <input
          type="text"
          class="w-full rounded border border-clinical-border bg-clinical-bg px-2.5 py-1.5 text-sm text-clinical-text outline-none transition-colors focus:border-clinical-primary/50 focus:ring-1 focus:ring-clinical-primary/30 disabled:cursor-not-allowed disabled:text-clinical-muted"
          placeholder={section.type === 'list' ? 'Comma-separated values...' : 'Enter value...'}
          value={textInput}
          oninput={handleTextInput}
          disabled={readOnly}
        />
      {/if}

      <!-- Source text (shown for auto-populated fields) -->
      {#if fieldState?.sourceText && fieldState.status !== 'empty'}
        <p class="mt-1 text-xs text-clinical-muted italic truncate" title={fieldState.sourceText}>
          Source: "{fieldState.sourceText.slice(0, 100)}{fieldState.sourceText.length > 100 ? '...' : ''}"
        </p>
      {/if}
    </div>
  </div>
{/if}
