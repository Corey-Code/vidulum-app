/**
 * Jest Test Setup
 * 
 * Global mocks and test utilities
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = TextDecoder;
}

// Polyfill Response for jsdom (used in failover.ts)
if (typeof Response === 'undefined') {
  // @ts-ignore
  global.Response = class Response {
    ok: boolean;
    status: number;
    statusText: string;
    
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.ok = init?.status ? init.status >= 200 && init.status < 300 : true;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || '';
    }
    
    json() {
      return Promise.resolve({});
    }
    
    text() {
      return Promise.resolve('');
    }
  };
}

// Mock AbortSignal.timeout if not available
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

// Mock the browser extension API
const mockBrowser = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
    session: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onSuspend: {
      addListener: jest.fn(),
    },
    id: 'test-extension-id',
  },
};

// @ts-ignore
global.browser = mockBrowser;
// @ts-ignore
global.chrome = mockBrowser;

// Mock fetch globally
global.fetch = jest.fn();

// Use Node.js crypto for tests (provides real Web Crypto API)
// This is needed for CosmJS and other crypto libraries
import { webcrypto } from 'crypto';

const nodeCrypto = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      webcrypto.getRandomValues(array as any);
    }
    return array;
  },
  randomUUID: () => webcrypto.randomUUID(),
  subtle: webcrypto.subtle,
};

Object.defineProperty(global, 'crypto', {
  value: nodeCrypto,
  writable: true,
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockReset();
});

// Helper to create mock fetch responses
export function mockFetchResponse(data: unknown, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options;
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
  });
}

// Helper to create mock fetch error
export function mockFetchError(message: string) {
  return Promise.reject(new Error(message));
}

// Helper to create sequential mock responses
export function mockFetchSequence(responses: Array<{ data?: unknown; error?: string; ok?: boolean; status?: number }>) {
  let callIndex = 0;
  (global.fetch as jest.Mock).mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    
    if (response.error) {
      return Promise.reject(new Error(response.error));
    }
    
    return mockFetchResponse(response.data, { ok: response.ok, status: response.status });
  });
}

// Export mock for direct access in tests
export { mockBrowser };
