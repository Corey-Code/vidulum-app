/**
 * Endpoint Failover Utility
 *
 * Provides automatic failover logic for network endpoints.
 * Tracks endpoint health and automatically routes requests to healthy endpoints.
 */

import { EndpointHealth } from './types';

// Configuration for failover behavior
export interface FailoverConfig {
  maxRetries: number; // Max retries per endpoint before failing over
  retryDelayMs: number; // Delay between retries (ms)
  requestTimeoutMs: number; // Request timeout (ms)
  failureThreshold: number; // Consecutive failures before marking unhealthy
  recoveryTimeMs: number; // Time before retrying an unhealthy endpoint (ms)
}

// Default failover configuration
const DEFAULT_CONFIG: FailoverConfig = {
  maxRetries: 2,
  retryDelayMs: 1000,
  requestTimeoutMs: 15000,
  failureThreshold: 3,
  recoveryTimeMs: 60000, // 1 minute
};

// HTTP status codes that indicate server-side issues (should trigger failover)
const SERVER_ERROR_CODES = [500, 502, 503, 504, 520, 521, 522, 523, 524];

/**
 * Check if a JSON-RPC error code is a server-side error (should trigger failover)
 * Server errors: -32000 to -32099 (implementation-defined)
 * Client errors: -32600 to -32603 (should NOT trigger failover)
 * See: https://www.jsonrpc.org/specification#error_object
 */
function isRpcServerErrorCode(code: number): boolean {
  // Server error range: -32000 to -32099
  return code >= -32099 && code <= -32000;
}

// Global health tracking for all endpoints
const endpointHealthMap: Map<string, EndpointHealth> = new Map();

/**
 * Get or create health status for an endpoint
 */
function getEndpointHealth(url: string): EndpointHealth {
  if (!endpointHealthMap.has(url)) {
    endpointHealthMap.set(url, {
      url,
      consecutiveFailures: 0,
      isHealthy: true,
    });
  }
  return endpointHealthMap.get(url)!;
}

/**
 * Mark an endpoint as successful
 */
function markEndpointSuccess(url: string): void {
  const health = getEndpointHealth(url);
  health.lastSuccess = Date.now();
  health.consecutiveFailures = 0;
  health.isHealthy = true;
}

/**
 * Mark an endpoint as failed
 */
function markEndpointFailure(url: string, config: FailoverConfig = DEFAULT_CONFIG): void {
  const health = getEndpointHealth(url);
  health.lastFailure = Date.now();
  health.consecutiveFailures++;

  if (health.consecutiveFailures >= config.failureThreshold) {
    health.isHealthy = false;
    console.warn(`Endpoint marked unhealthy after ${health.consecutiveFailures} failures: ${url}`);
  }
}

/**
 * Check if an endpoint should be tried (healthy or recovery time elapsed)
 */
function shouldTryEndpoint(url: string, config: FailoverConfig = DEFAULT_CONFIG): boolean {
  const health = getEndpointHealth(url);

  if (health.isHealthy) return true;

  // Check if recovery time has elapsed
  if (health.lastFailure && Date.now() - health.lastFailure >= config.recoveryTimeMs) {
    console.log(`Retrying previously unhealthy endpoint: ${url}`);
    return true;
  }

  return false;
}

/**
 * Get sorted endpoints by health (healthy first, then by last success time)
 */
export function getSortedEndpoints(
  endpoints: string[],
  config: FailoverConfig = DEFAULT_CONFIG
): string[] {
  return [...endpoints].sort((a, b) => {
    const healthA = getEndpointHealth(a);
    const healthB = getEndpointHealth(b);

    // Healthy endpoints first
    if (healthA.isHealthy !== healthB.isHealthy) {
      return healthA.isHealthy ? -1 : 1;
    }

    // Among healthy, prefer more recently successful
    if (healthA.lastSuccess && healthB.lastSuccess) {
      return healthB.lastSuccess - healthA.lastSuccess;
    }

    // Prefer endpoints that have been tried
    if (healthA.lastSuccess && !healthB.lastSuccess) return -1;
    if (!healthA.lastSuccess && healthB.lastSuccess) return 1;

    return 0;
  });
}

/**
 * Check if an error is a server-side error that warrants failover
 */
function isServerError(error: unknown): boolean {
  // Check if it's a Response-like object (duck typing for compatibility)
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    return SERVER_ERROR_CODES.includes((error as { status: number }).status);
  }

  // Check if it's an RpcError with a code property (JSON-RPC errors)
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'number'
  ) {
    return isRpcServerErrorCode((error as { code: number }).code);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors, timeouts, and connection issues
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('socket') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch') ||
      message.includes('aborted') ||
      message.includes('rpc server error') // JSON-RPC server errors from EVM client
    ) {
      return true;
    }

    // Check for HTTP status codes in error message
    for (const code of SERVER_ERROR_CODES) {
      if (message.includes(`${code}`)) return true;
    }
  }

  return false;
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

/**
 * Execute a fetch request with failover across multiple endpoints
 */
export async function fetchWithFailover<T>(
  endpoints: string[],
  pathOrUrl: string,
  options: RequestInit = {},
  config: Partial<FailoverConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sortedEndpoints = getSortedEndpoints(endpoints, cfg);
  const errors: Error[] = [];

  for (const baseUrl of sortedEndpoints) {
    if (!shouldTryEndpoint(baseUrl, cfg)) {
      continue;
    }

    const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : `${baseUrl}${pathOrUrl}`;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      const { controller, timeoutId } = createTimeoutController(cfg.requestTimeoutMs);

      try {
        const response = await fetch(fullUrl, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (SERVER_ERROR_CODES.includes(response.status)) {
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
          // Client errors (4xx) should not trigger failover
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        markEndpointSuccess(baseUrl);
        return data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);

        // Check if this is a server-side error that warrants failover
        if (isServerError(error) || err.name === 'AbortError') {
          markEndpointFailure(baseUrl, cfg);

          // Retry on same endpoint if we have retries left
          if (attempt < cfg.maxRetries) {
            console.log(`Retrying ${fullUrl} (attempt ${attempt + 2}/${cfg.maxRetries + 1})`);
            await delay(cfg.retryDelayMs);
            continue;
          }

          // Move to next endpoint
          console.warn(`Endpoint failed, trying next: ${baseUrl}`);
          break;
        }

        // Client-side errors (4xx, parsing, etc.) - don't failover, throw immediately
        throw error;
      }
    }
  }

  // All endpoints failed
  const lastError = errors[errors.length - 1];
  throw new Error(
    `All endpoints failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Tried ${sortedEndpoints.length} endpoint(s).`
  );
}

/**
 * Execute a custom async operation with failover across multiple endpoints
 * Useful for operations that don't use standard fetch (e.g., WebSocket, gRPC)
 */
export async function withFailover<T>(
  endpoints: string[],
  operation: (endpoint: string) => Promise<T>,
  config: Partial<FailoverConfig> = {}
): Promise<{ result: T; endpoint: string }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sortedEndpoints = getSortedEndpoints(endpoints, cfg);
  const errors: Error[] = [];

  for (const endpoint of sortedEndpoints) {
    if (!shouldTryEndpoint(endpoint, cfg)) {
      continue;
    }

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Operation timeout')), cfg.requestTimeoutMs);
        });

        const result = await Promise.race([operation(endpoint), timeoutPromise]);
        markEndpointSuccess(endpoint);
        return { result, endpoint };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(err);

        if (isServerError(error) || err.message.includes('timeout')) {
          markEndpointFailure(endpoint, cfg);

          if (attempt < cfg.maxRetries) {
            console.log(
              `Retrying operation on ${endpoint} (attempt ${attempt + 2}/${cfg.maxRetries + 1})`
            );
            await delay(cfg.retryDelayMs);
            continue;
          }

          console.warn(`Operation failed on endpoint, trying next: ${endpoint}`);
          break;
        }

        // Non-server errors - throw immediately
        throw error;
      }
    }
  }

  const lastError = errors[errors.length - 1];
  throw new Error(
    `All endpoints failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Tried ${sortedEndpoints.length} endpoint(s).`
  );
}

/**
 * Get the first healthy endpoint from a list
 */
export function getHealthyEndpoint(
  endpoints: string[],
  config: Partial<FailoverConfig> = {}
): string | null {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sorted = getSortedEndpoints(endpoints, cfg);

  for (const endpoint of sorted) {
    if (shouldTryEndpoint(endpoint, cfg)) {
      return endpoint;
    }
  }

  // If no healthy endpoints, return the first one (will trigger recovery check)
  return endpoints[0] || null;
}

/**
 * Reset health status for all endpoints of a network
 */
export function resetEndpointHealth(endpoints: string[]): void {
  for (const url of endpoints) {
    endpointHealthMap.delete(url);
  }
}

/**
 * Get health status for debugging/monitoring
 */
export function getEndpointHealthStatus(endpoints: string[]): EndpointHealth[] {
  return endpoints.map((url) => getEndpointHealth(url));
}

/**
 * Clear all endpoint health data
 */
export function clearAllEndpointHealth(): void {
  endpointHealthMap.clear();
}
