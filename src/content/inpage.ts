// In-page provider stub. Exposes a minimal read-only bridge; never handles keys.

declare global {
  interface Window {
    vidulum?: unknown;
  }
}

window.vidulum = {
  isVidulum: true,
  request: async (args: { method: string }) => {
    return new Promise((resolve) => {
      window.postMessage({ source: 'vidulum-inpage', payload: args }, '*');
      resolve(null);
    });
  },
};
