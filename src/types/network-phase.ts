/**
 * Explicit network connection / endpoint health phases (P2).
 * Prefer these over boolean products (isConnecting × intentionalDisconnect × readyState).
 */

/** Cosmos Tendermint WebSocket connection lifecycle. */
export type WsConnState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'open' }
  | { status: 'reconnecting'; attempt: number }
  | { status: 'failed' }
  | { status: 'closed' }; // intentional disconnect

/** Endpoint health for failover routing. */
export type EndpointHealthPhase = 'healthy' | 'degraded' | 'unhealthy' | 'recovering';
