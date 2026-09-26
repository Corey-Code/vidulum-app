// Content script that injects the inpage provider.

const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/inpage.js');
script.type = 'module';
document.documentElement.appendChild(script);

export {};
