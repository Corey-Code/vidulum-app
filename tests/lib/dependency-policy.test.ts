/**
 * Dependency policy for in-range hygiene.
 *
 * Keeps UI, test, and lint majors on the versions this wallet already ships.
 * Crypto / seed / signing packages are listed only to freeze their current
 * majors — this suite does not exercise keys or signing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

type PackageJson = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const pkg: PackageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf8')
);

function expectCaretMajor(
  range: string | undefined,
  packageName: string,
  major: string
): void {
  expect(range).toBeDefined();
  expect(range).toMatch(new RegExp(`^\\^${major.replace('.', '\\.')}\\.`));
  expect(packageName.length).toBeGreaterThan(0);
}

describe('dependency policy', () => {
  it('keeps UI runtime majors on the current supported lines', () => {
    expectCaretMajor(pkg.dependencies.react, 'react', '18');
    expectCaretMajor(pkg.dependencies['react-dom'], 'react-dom', '18');
    expectCaretMajor(pkg.dependencies['@chakra-ui/react'], '@chakra-ui/react', '2');
    expectCaretMajor(pkg.dependencies['@chakra-ui/icons'], '@chakra-ui/icons', '2');
    expectCaretMajor(pkg.dependencies['@emotion/react'], '@emotion/react', '11');
    expectCaretMajor(pkg.dependencies['@emotion/styled'], '@emotion/styled', '11');
    expectCaretMajor(pkg.dependencies['framer-motion'], 'framer-motion', '10');
    expectCaretMajor(pkg.dependencies.zustand, 'zustand', '4');
    expectCaretMajor(pkg.dependencies['@skip-go/widget'], '@skip-go/widget', '3');
  });

  it('keeps test and toolchain majors on the current supported lines', () => {
    expectCaretMajor(pkg.devDependencies.jest, 'jest', '29');
    expectCaretMajor(pkg.devDependencies['ts-jest'], 'ts-jest', '29');
    expectCaretMajor(pkg.devDependencies.typescript, 'typescript', '5');
    expectCaretMajor(pkg.devDependencies.vite, 'vite', '7');
    expectCaretMajor(
      pkg.devDependencies['@vitejs/plugin-react'],
      '@vitejs/plugin-react',
      '4'
    );
    expectCaretMajor(
      pkg.devDependencies['@testing-library/react'],
      '@testing-library/react',
      '14'
    );
    expectCaretMajor(
      pkg.devDependencies['@testing-library/jest-dom'],
      '@testing-library/jest-dom',
      '6'
    );
  });

  it('declares the eslint toolchain used by npm run lint', () => {
    expectCaretMajor(pkg.devDependencies.eslint, 'eslint', '8');
    expect(pkg.devDependencies['@typescript-eslint/eslint-plugin']).toMatch(/^\^7\./);
    expect(pkg.devDependencies['@typescript-eslint/parser']).toMatch(/^\^7\./);
    expect(pkg.devDependencies['eslint-plugin-react']).toMatch(/^\^7\./);
    expect(pkg.devDependencies['eslint-plugin-react-hooks']).toMatch(/^\^4\./);
  });

  it('freezes cosmjs on the already-shipped 0.32 line', () => {
    const cosmjsPackages = [
      '@cosmjs/amino',
      '@cosmjs/crypto',
      '@cosmjs/encoding',
      '@cosmjs/proto-signing',
      '@cosmjs/stargate',
    ] as const;

    for (const name of cosmjsPackages) {
      expectCaretMajor(pkg.dependencies[name], name, '0.32');
    }
  });
});
