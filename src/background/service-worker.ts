// Extension background service worker.
// Handles lifecycle events only; no key material or signing logic lives here.

chrome.runtime.onInstalled.addListener(() => {
  console.log('vidulum-app installed');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'ping') {
    sendResponse({ ok: true });
  }
  return false;
});
