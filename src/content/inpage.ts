// In-page provider bootstrap.
window.postMessage({ type: 'VIDULUM_REQUEST', payload: { method: 'vidulum_connect' } }, '*');
