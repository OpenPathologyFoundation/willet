<script lang="ts">
  import { onMount } from 'svelte';
  import ReportModule from '$lib/ReportModule.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import type { ModuleEvent, UserRole } from '$lib/types';

  // In integrated mode, props come from the Okapi orchestrator via postMessage.
  // This is a placeholder — full bridge integration is Stage 4.
  // For now, read from URL params for manual testing.

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('caseId') ?? 'S26-0004';
  const role = (params.get('role') as UserRole) ?? 'ATTENDING';

  onMount(() => {
    themeStore.init();
  });

  function handleEvent(event: ModuleEvent) {
    // In Stage 4, this will postMessage to the Okapi orchestrator
    console.log('[WILLET Integrated] ModuleEvent:', event);
    window.parent?.postMessage(
      { ...event, type: `willet:${event.type.toLowerCase()}` },
      '*',
    );
  }
</script>

<ReportModule
  {caseId}
  jwt="integrated-jwt-placeholder"
  {role}
  apiBase=""
  onEvent={handleEvent}
/>
