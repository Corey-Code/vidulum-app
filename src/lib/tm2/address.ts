/**
 * Gno.land / tm2 address helpers.
 *
 * Same secp256k1 + BIP44 coin type 118 as Cosmos; only the bech32 HRP differs (`g`).
 */

import { fromBech32, toBech32 } from '@cosmjs/encoding';
import { Secp256k1HdWallet } from '@cosmjs/amino';
import { stringToPath } from '@cosmjs/crypto';

export const TM2_DEFAULT_BECH32_PREFIX = 'g';
export const TM2_COIN_TYPE = 118;

export function getTm2DerivationPath(accountIndex: number = 0): string {
  return `m/44'/${TM2_COIN_TYPE}'/${accountIndex}'/0/0`;
}

/**
 * Re-encode a Cosmos-family bech32 address under the tm2 HRP (default `g`).
 */
export function convertToTm2Address(
  cosmosOrAnyBech32: string,
  prefix: string = TM2_DEFAULT_BECH32_PREFIX
): string {
  const { data } = fromBech32(cosmosOrAnyBech32);
  return toBech32(prefix, data);
}

export function isValidTm2Address(
  address: string,
  prefix: string = TM2_DEFAULT_BECH32_PREFIX
): boolean {
  try {
    const decoded = fromBech32(address);
    return decoded.prefix === prefix && decoded.data.length === 20;
  } catch {
    return false;
  }
}

/**
 * Derive a tm2 (`g1…`) address from a mnemonic at the standard Cosmos HD path.
 */
export async function deriveTm2AddressFromMnemonic(
  mnemonic: string,
  accountIndex: number = 0,
  prefix: string = TM2_DEFAULT_BECH32_PREFIX
): Promise<string> {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix,
    hdPaths: [stringToPath(getTm2DerivationPath(accountIndex))],
  });
  const [account] = await wallet.getAccounts();
  return account.address;
}
