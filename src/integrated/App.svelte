<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ReportModule from '$lib/ReportModule.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { createOrchestratorBridge } from '$lib/orchestrator-bridge';
  import type { ModuleEvent, UserRole } from '$lib/types';

  // Integrated mode activation contract (see willet/qms/dhf/01-URS.md §2.5.1):
  //  - The Starling orchestrator embeds this entry in an iframe (or opens it
  //    as a window) and sends an `orchestrator:init` postMessage carrying
  //    caseId, token, role, apiBase, and orchestratorOrigin.
  //  - Willet forwards internal ModuleEvents (REPORT_FINALIZED,
  //    LOCK_ACQUIRED, ...) back to the host as `module:audit-event`.
  //  - For standalone manual testing, URL params still work as a fallback so
  //    the dev harness can exercise the same ReportModule without a host.

  const params = new URLSearchParams(window.location.search);
  const orchestratorOrigin = params.get('origin') ?? window.location.origin;

  let caseId = $state<string>(params.get('caseId') ?? 'S26-0004');
  let role = $state<UserRole>((params.get('role') as UserRole) ?? 'ATTENDING');
  let jwt = $state<string>('integrated-jwt-placeholder');
  let apiBase = $state<string>('');
  let initialized = $state<boolean>(false);

  const bridge = createOrchestratorBridge({
    expectedOrigin: orchestratorOrigin,
    onInit(payload) {
      caseId = payload.caseId;
      role = payload.role ?? role;
      jwt = payload.token;
      apiBase = payload.apiBase ?? '';
      initialized = true;
    },
    onTokenRefresh(payload) {
      jwt = payload.token;
    },
    onLogout() {
      jwt = '';
      initialized = false;
    },
  });

  onMount(() => {
    themeStore.init();
    // Tell the host we are mounted. Host responds with orchestrator:init.
    bridge.ready();
  });

  onDestroy(() => bridge.dispose());

  function handleEvent(event: ModuleEvent) {
    bridge.emitModuleEvent(event);
  }
</script>

{#if initialized || params.has('caseId')}
  <ReportModule {caseId} {jwt} {role} {apiBase} onEvent={handleEvent} />
{:else}
  <div style="padding:1rem;font-family:system-ui;color:#555">
    Waiting for Starling orchestrator to send <code>orchestrator:init</code>…
  </div>
{/if}
