/**
 * Injected into the page context to bridge window messages to the content script.
 */
export const INJECT_BRIDGE_SOURCE = 'vidulum:inject';

export function postToContent(message: unknown): void {
  window.postMessage({ source: INJECT_BRIDGE_SOURCE, message }, '*');
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as { source?: string } | null;
  if (data?.source !== 'vidulum:content') return;
  // Forward to page-level provider listeners.
  window.dispatchEvent(new CustomEvent('vidulum:provider-message', { detail: data }));
});
