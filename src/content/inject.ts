// Injected page script bridge.
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'VIDULUM_REQUEST') {
    window.postMessage({ type: 'VIDULUM_RESPONSE', payload: null }, '*');
  }
});
