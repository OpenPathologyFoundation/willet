import '../app.css';
import App from './App.svelte';
import { mount } from 'svelte';

// Integrated mode: Willet is launched by the Starling orchestrator in an iframe
// and expects the auth-system to serve its API surface.
//
// Dev-only escape hatch: when VITE_WILLET_MOCK_API=true, we boot the same MSW
// worker the standalone demo uses so Willet's API calls (/api/user/preferences,
// /api/report/{accession}/scaffold, etc.) resolve against in-memory fixtures
// instead of 500-ing against an auth-system that hasn't implemented them yet.
// This lets us demo the orchestrated flow end-to-end before the real endpoints
// land. Toggle via `make willet-demo` (mocks on) vs `make willet` (real API).
const MOCK_API = import.meta.env.VITE_WILLET_MOCK_API === 'true';

async function bootstrap() {
  if (MOCK_API) {
    const { worker } = await import('../mocks/browser');
    // Willet is served under VITE_BASE (e.g. /report/) when orchestrated
    // behind nginx, so the service worker script lives at `${base}mockServiceWorker.js`
    // and its scope must match. Without this, MSW asks for /mockServiceWorker.js
    // at the proxy root and gets a 404.
    const base = import.meta.env.BASE_URL || '/';
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: `${base}mockServiceWorker.js`,
        options: { scope: base },
      },
    });
    console.log(`[WILLET Integrated] MSW started at scope ${base} — API requests will be mocked (VITE_WILLET_MOCK_API=true)`);
  }

  mount(App, { target: document.getElementById('app')! });
}

bootstrap();
