// Injects the inpage script into the page context.

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inpage.js');
script.type = 'text/javascript';
(document.head || document.documentElement).appendChild(script);
