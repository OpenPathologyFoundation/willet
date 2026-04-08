import '../app.css';
import App from './App.svelte';
import { mount } from 'svelte';

// Start MSW before mounting the app
async function bootstrap() {
  const { worker } = await import('../mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
  console.log('[WILLET Standalone] MSW started — API requests will be mocked');

  mount(App, { target: document.getElementById('app')! });
}

bootstrap();
