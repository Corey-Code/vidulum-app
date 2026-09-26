// Background service worker entry point.
chrome.runtime.onInstalled.addListener(() => {
  console.log('Vidulum extension installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ping') {
    sendResponse({ ok: true });
  }
  return true;
});
