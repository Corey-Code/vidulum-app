import { INJECT_BRIDGE_SOURCE } from './inject';

const CONTENT_SOURCE = 'vidulum:content';

export function initInpage(): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data as { source?: string; message?: unknown } | null;
    if (data?.source !== INJECT_BRIDGE_SOURCE) return;
    // Relay to the extension content script channel.
    window.postMessage({ source: CONTENT_SOURCE, message: data.message }, '*');
  });
}

initInpage();
