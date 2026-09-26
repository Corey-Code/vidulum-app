const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'build');

fs.cpSync(src, path.join(dest, 'public'), { recursive: true });
console.log('Copied static assets.');
