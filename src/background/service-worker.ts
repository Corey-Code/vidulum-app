// Background service worker entry point.
// Note: this module must never handle seeds, private keys, or signing secrets.

chrome.runtime.onInstalled.addListener(() => {
  console.log('Vidulum service worker installed.');
});

export {};
