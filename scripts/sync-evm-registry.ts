import fs from 'fs';
import path from 'path';

const outPath = path.resolve(__dirname, '..', 'src/lib/assets/evmRegistry.ts');

export function syncEvmRegistry(data: unknown): void {
  fs.writeFileSync(outPath, `// Auto-generated\nexport const evmRegistry = ${JSON.stringify(data, null, 2)} as const;\n`);
}

if (require.main === module) {
  syncEvmRegistry([]);
}
