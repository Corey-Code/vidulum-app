/**
 * tm2 / Gno.land address derivation tests
 */

import { Secp256k1HdWallet } from '@cosmjs/amino';
import { stringToPath } from '@cosmjs/crypto';
import {
  convertToTm2Address,
  deriveTm2AddressFromMnemonic,
  getTm2DerivationPath,
  isValidTm2Address,
} from '@/lib/tm2';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('tm2 address helpers', () => {
  it('uses BIP44 coin type 118', () => {
    expect(getTm2DerivationPath(0)).toBe("m/44'/118'/0'/0/0");
    expect(getTm2DerivationPath(1)).toBe("m/44'/118'/1'/0/0");
  });

  it('derives a g1 address from mnemonic', async () => {
    const address = await deriveTm2AddressFromMnemonic(MNEMONIC, 0);
    expect(address.startsWith('g1')).toBe(true);
    expect(isValidTm2Address(address)).toBe(true);
  });

  it('matches Cosmos HD bytes re-encoded with HRP g', async () => {
    const cosmosWallet = await Secp256k1HdWallet.fromMnemonic(MNEMONIC, {
      prefix: 'cosmos',
      hdPaths: [stringToPath("m/44'/118'/0'/0/0")],
    });
    const [cosmosAccount] = await cosmosWallet.getAccounts();
    const gnoFromConvert = convertToTm2Address(cosmosAccount.address);
    const gnoFromMnemonic = await deriveTm2AddressFromMnemonic(MNEMONIC, 0);
    expect(gnoFromConvert).toBe(gnoFromMnemonic);
    expect(gnoFromConvert).toBe('g19rl4cm2hmr8afy4kldpxz3fka4jguq0a0u3773');
  });

  it('rejects invalid addresses', () => {
    expect(isValidTm2Address('cosmos1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqnrql8a')).toBe(false);
    expect(isValidTm2Address('not-an-address')).toBe(false);
  });
});
