// Inpage provider bridge.

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (data && data.vidulum) {
    // Forward approved requests to the extension background.
    chrome.runtime.sendMessage(data);
  }
});

export {};
