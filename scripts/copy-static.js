// Copies public/ assets into the build output directory.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../public');
const dest = process.argv[2] || path.resolve(__dirname, '../dist/public');

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('Copied static assets to', dest);
