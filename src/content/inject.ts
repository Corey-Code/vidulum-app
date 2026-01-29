const injectKeplrAPI = () => {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // This code runs in the PAGE context, not content script context
      window.keplr = {
        enable: async (chainId) => {
          throw new Error('keplr.enable is not implemented in this injected script.');
        },
        getKey: async (chainId) => {
          throw new Error('keplr.getKey is not implemented in this injected script.');
        },
        // ... other methods
      };
      
      window.getOfflineSigner = window.keplr.getOfflineSigner;
    })();
  `;

  // Inject into the page
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up
};
