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

function caretVersionTuple(range: string | undefined): [number, number, number] {
  expect(range).toMatch(/^\^\d+\.\d+\.\d+$/);
  const [major, minor, patch] = range!.slice(1).split('.').map(Number);
  return [major, minor, patch];
}

function expectCaretAtLeast(
  range: string | undefined,
  packageName: string,
  minimum: string
): void {
  const current = caretVersionTuple(range);
  const [minMajor, minMinor, minPatch] = minimum.split('.').map(Number);
  const currentRank = current[0] * 1_000_000 + current[1] * 1_000 + current[2];
  const minimumRank = minMajor * 1_000_000 + minMinor * 1_000 + minPatch;
  expect(currentRank).toBeGreaterThanOrEqual(minimumRank);
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

  it('raises leftover same-line floors that in-range caret could not reach', () => {
    expectCaretAtLeast(pkg.dependencies['@chakra-ui/icons'], '@chakra-ui/icons', '2.2.6');
    expectCaretAtLeast(
      pkg.devDependencies['vite-plugin-node-polyfills'],
      'vite-plugin-node-polyfills',
      '0.28.0'
    );
    expectCaretAtLeast(pkg.devDependencies['@types/chrome'], '@types/chrome', '0.0.332');
  });

  it('freezes seed and signing package majors without upgrading them', () => {
    expectCaretMajor(pkg.dependencies['@noble/curves'], '@noble/curves', '2');
    expectCaretMajor(pkg.dependencies['@noble/hashes'], '@noble/hashes', '1');
    expectCaretMajor(pkg.dependencies['@noble/secp256k1'], '@noble/secp256k1', '2');
    expectCaretMajor(pkg.dependencies.bip32, 'bip32', '4');
    expectCaretMajor(pkg.dependencies.bip39, 'bip39', '3');
    expectCaretMajor(
      pkg.dependencies['webextension-polyfill'],
      'webextension-polyfill',
      '0.10'
    );
  });
});
