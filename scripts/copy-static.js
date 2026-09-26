const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'public');
const outDir = path.resolve(__dirname, '..', 'dist');

fs.mkdirSync(outDir, { recursive: true });
for (const file of fs.readdirSync(srcDir)) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}
console.log('Static assets copied to dist/');
