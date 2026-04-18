/**
 * Willet ↔ Starling orchestrator bridge.
 *
 * Protocol-compatible with @starling/module-protocol v1.0. Kept as a local
 * implementation (no runtime dependency on the Starling workspace) so Willet
 * can be developed and released independently. The message envelope below
 * MUST stay in lockstep with `starling/packages/module-protocol/src/index.ts`.
 *
 * See: starling/qms/dhf/04-SDS/07-Module-Orchestration-Architecture.md
 * See: willet/qms/dhf/01-URS.md §2.5.1 Activation Contract
 */

import type { ModuleEvent, UserRole } from './types';

export type ProtocolVersion = '1.0';

export interface BaseInitPayload {
	token: string;
	userId: string;
	orchestratorOrigin: string;
}

export interface ReportInitPayload extends BaseInitPayload {
	caseId: string;
	accession: string;
	role?: UserRole;
	apiBase?: string;
}

export type OrchestratorMessage =
	| { type: 'orchestrator:init'; payload: ReportInitPayload }
	| { type: 'orchestrator:token-refresh'; payload: { token: string } }
	| { type: 'orchestrator:focus'; payload: { state: 'active' | 'blurred' } }
	| { type: 'orchestrator:context-update'; payload: { key: string; value: unknown } }
	| { type: 'orchestrator:heartbeat'; payload: { timestamp: number } }
	| { type: 'orchestrator:logout'; payload: Record<string, never> };

export interface OrchestratorBridgeOptions {
	expectedOrigin: string;
	onInit: (payload: ReportInitPayload) => void;
	onTokenRefresh?: (payload: { token: string }) => void;
	onFocus?: (payload: { state: 'active' | 'blurred' }) => void;
	onLogout?: () => void;
}

export interface OrchestratorBridge {
	ready(): void;
	error(code: string, message: string): void;
	updateState(key: string, value: unknown): void;
	emitModuleEvent(event: ModuleEvent): void;
	dispose(): void;
}

/**
 * Create the orchestrator-facing bridge. Call from the integrated entrypoint
 * (src/integrated/main.ts) to consume `orchestrator:init` and forward
 * lifecycle events (REPORT_FINALIZED, LOCK_ACQUIRED, ...) back to Starling as
 * `module:audit-event` messages.
 */
export function createOrchestratorBridge(options: OrchestratorBridgeOptions): OrchestratorBridge {
	function host(): Window | null {
		if (window.opener && !window.opener.closed) return window.opener;
		if (window.parent && window.parent !== window) return window.parent;
		return null;
	}

	function post(msg: unknown): void {
		host()?.postMessage(msg, options.expectedOrigin);
	}

	function handle(event: MessageEvent<OrchestratorMessage>): void {
		if (event.origin !== options.expectedOrigin) return;
		switch (event.data.type) {
			case 'orchestrator:init':
				options.onInit(event.data.payload);
				break;
			case 'orchestrator:token-refresh':
				options.onTokenRefresh?.(event.data.payload);
				break;
			case 'orchestrator:focus':
				options.onFocus?.(event.data.payload);
				break;
			case 'orchestrator:heartbeat':
				post({
					type: 'module:heartbeat-ack',
					payload: { timestamp: event.data.payload.timestamp },
				});
				break;
			case 'orchestrator:logout':
				options.onLogout?.();
				break;
		}
	}

	window.addEventListener('message', handle);

	return {
		ready() {
			post({ type: 'module:ready', payload: {} });
		},
		error(code, message) {
			post({ type: 'module:error', payload: { code, message } });
		},
		updateState(key, value) {
			post({ type: 'module:state-update', payload: { key, value } });
		},
		emitModuleEvent(event) {
			// Willet-native ModuleEvent (e.g. REPORT_FINALIZED) is forwarded as
			// a module:audit-event whose metadata carries the original payload.
			post({
				type: 'module:audit-event',
				payload: {
					eventType: `willet.${event.type}`,
					occurredAt: new Date().toISOString(),
					metadata: event as unknown as Record<string, unknown>,
				},
			});
		},
		dispose() {
			window.removeEventListener('message', handle);
		},
	};
}
