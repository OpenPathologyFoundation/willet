import '../app.css';
import App from './App.svelte';
import { mount } from 'svelte';

// Integrated mode: no MSW, no mocks — real API calls to auth-system.
// Mount props will be provided by the Okapi orchestrator.
mount(App, { target: document.getElementById('app')! });
