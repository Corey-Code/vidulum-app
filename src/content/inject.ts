const injectKeplrAPI = () => {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // This code runs in the PAGE context, not content script context
      window.keplr = {
        enable: async (chainId) => { ... },
        getKey: async (chainId) => { ... },
        // ... other methods
      };
      
      window.getOfflineSigner = window.keplr.getOfflineSigner;
    })();
  `;

  // Inject into the page
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // Clean up
};
