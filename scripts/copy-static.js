const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'public');
const dest = path.resolve(__dirname, '..', 'build');

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied static assets to build/');
