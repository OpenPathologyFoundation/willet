// Service context — created once at mount, consumed by all components.
// SDS 04-00 §3.3: mode resolution via injected services.

import { getContext, setContext } from 'svelte';
import { createApiClient, type ApiClient } from './api';
import type { UserRole, ModuleEvent } from '$lib/types';

const CONTEXT_KEY = Symbol('willet-services');

export interface WilletServices {
  api: ApiClient;
  jwt: () => string;
  role: UserRole;
  emitEvent: (event: ModuleEvent) => void;
}

export interface ServiceConfig {
  apiBase: string;
  jwt: string;
  role: UserRole;
  caseId: string;
  onEvent: (event: ModuleEvent) => void;
}

export function createServices(config: ServiceConfig): WilletServices {
  let currentJwt = config.jwt;

  const services: WilletServices = {
    api: createApiClient(config.apiBase, () => currentJwt),
    jwt: () => currentJwt,
    role: config.role,
    emitEvent(event) {
      config.onEvent(event);
    },
  };

  return services;
}

export function setServiceContext(services: WilletServices): void {
  setContext(CONTEXT_KEY, services);
}

export function getServices(): WilletServices {
  return getContext<WilletServices>(CONTEXT_KEY);
}
