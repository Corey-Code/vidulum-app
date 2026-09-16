/**
 * UTXO address interoperability vectors
 *
 * These assert Vidulum's BIP32/BIP39 derivation + address encoding against
 * published BIP / wallet-core vectors. Account 0 must match Electrum,
 * Sparrow, Ledger, Trezor, and Ian Coleman BIP39 when imported with the
 * same mnemonic, empty passphrase, and matching purpose/coin type.
 *
 * Do not use this mnemonic for funds.
 */

import * as bip39 from 'bip39';
import { Keyring } from '@/lib/crypto/keyring';
import {
  UTXO_NETWORKS,
  UtxoNetworkId,
  deriveBitcoinKeyPairFromSeed,
  getUtxoAddress,
  getUtxoDerivationPath,
} from '@/lib/crypto/bitcoin';
import { BITCOIN_NETWORKS } from '@/lib/networks/bitcoin';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

async function seedFromMnemonic(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
  return new Uint8Array(await bip39.mnemonicToSeed(mnemonic, passphrase));
}

async function deriveAddress(
  seed: Uint8Array,
  networkId: UtxoNetworkId,
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent',
  accountIndex = 0,
  isChange = false
) {
  const path = getUtxoDerivationPath(networkId, accountIndex, 0, isChange, addressType);
  const keyPair = await deriveBitcoinKeyPairFromSeed(seed, path);
  return {
    path,
    pubkey: Buffer.from(keyPair.publicKey).toString('hex'),
    privkey: Buffer.from(keyPair.privateKey).toString('hex'),
    address: getUtxoAddress(keyPair.publicKey, networkId, addressType),
  };
}

describe('UTXO address vectors (other-wallet interoperability)', () => {
  let seed: Uint8Array;

  beforeAll(async () => {
    seed = await seedFromMnemonic(MNEMONIC);
  });

  describe('BIP84 Bitcoin native SegWit (official test vectors)', () => {
    it('matches m/84\'/0\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2wpkh', 0);
      expect(got.path).toBe("m/84'/0'/0'/0/0");
      expect(got.pubkey).toBe(
        '0330d54fd0dd420a6e5f8d3624f5f3482cae350f79d5f0753bf5beef9c2d91af3c'
      );
      expect(got.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    });

    it('matches m/84\'/0\'/0\'/0/1 (second receive = Vidulum account 1)', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2wpkh', 1);
      expect(got.path).toBe("m/84'/0'/0'/0/1");
      expect(got.pubkey).toBe(
        '03e775fd51f0dfb8cd865d9ff1cca2a158cf651fe997fdc9fee9c1d3b5e995ea77'
      );
      expect(got.address).toBe('bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
    });

    it('matches m/84\'/0\'/0\'/1/0 change address', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2wpkh', 0, true);
      expect(got.path).toBe("m/84'/0'/0'/1/0");
      expect(got.pubkey).toBe(
        '03025324888e429ab8e3dbaf1f7802648b9cd01e9b418485c5fa4c1b9b5700e1a6'
      );
      expect(got.address).toBe('bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');
    });
  });

  describe('BIP49 nested SegWit', () => {
    it('matches official BIP49 testnet vector m/49\'/1\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'bitcoin-testnet', 'p2sh-p2wpkh', 0);
      expect(got.path).toBe("m/49'/1'/0'/0/0");
      expect(got.pubkey).toBe(
        '03a1af804ac108a8a51782198c2d034b28bf90c8803f5a53f76276fa69a4eae77f'
      );
      expect(got.address).toBe('2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2');
    });

    it('matches SLIP-0132 BIP49 mainnet m/49\'/0\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2sh-p2wpkh', 0);
      expect(got.path).toBe("m/49'/0'/0'/0/0");
      expect(got.pubkey).toBe(
        '039b3b694b8fc5b5e07fb069c783cac754f5d38c3e08bed1960e31fdb1dda35c24'
      );
      expect(got.address).toBe('37VucYSaXLCAsxYyAPfbSi9eh4iEcbShgf');
    });
  });

  describe('BIP44 legacy P2PKH', () => {
    it('matches SLIP-0132 BTC m/44\'/0\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2pkh', 0);
      expect(got.path).toBe("m/44'/0'/0'/0/0");
      expect(got.pubkey).toBe(
        '03aaeb52dd7494c361049de67cc680e83ebcbbbdbeb13637d92cd845f70308af5e'
      );
      expect(got.privkey).toBe(
        'e284129cc0922579a535bbf4d1a3b25773090d28c909bc0fed73b5e0222cc372'
      );
      expect(got.address).toBe('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });
  });

  describe('altcoin account 0 (bitcoinjs-lib / Electrum-compatible)', () => {
    it('Litecoin native SegWit m/84\'/2\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'litecoin-mainnet', 'p2wpkh', 0);
      expect(got.path).toBe("m/84'/2'/0'/0/0");
      expect(got.address).toBe('ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh');
    });

    it('Dogecoin legacy m/44\'/3\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'dogecoin-mainnet', 'p2pkh', 0);
      expect(got.path).toBe("m/44'/3'/0'/0/0");
      expect(got.address).toBe('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC');
    });

    it('Ravencoin legacy m/44\'/175\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'ravencoin-mainnet', 'p2pkh', 0);
      expect(got.path).toBe("m/44'/175'/0'/0/0");
      expect(got.address).toBe('RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V');
    });

    it('NOSO (Dash coin type + prefixes) m/44\'/5\'/0\'/0/0', async () => {
      const got = await deriveAddress(seed, 'noso-mainnet', 'p2pkh', 0);
      expect(got.path).toBe("m/44'/5'/0'/0/0");
      expect(got.address).toBe('XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5');
    });
  });

  describe('Keyring uses the same account-0 addresses as other wallets', () => {
    it('Bitcoin default p2wpkh matches BIP84', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(MNEMONIC, 'bze', [0]);
      const account = await keyring.deriveBitcoinAccount(
        'bitcoin-mainnet',
        'mainnet',
        0,
        'p2wpkh'
      );
      expect(account.hdPath).toBe("m/84'/0'/0'/0/0");
      expect(account.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    });

    it('dumps every enabled UTXO chain account-0 address for import comparison', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(MNEMONIC, 'bze', [0]);
      const rows: Array<Record<string, string>> = [];

      for (const network of BITCOIN_NETWORKS.filter((n) => n.enabled)) {
        const networkId = network.id as UtxoNetworkId;
        if (!(networkId in UTXO_NETWORKS)) {
          throw new Error(`Missing UTXO_NETWORKS entry for ${network.id}`);
        }
        const account = await keyring.deriveBitcoinAccount(
          network.id,
          network.network,
          0,
          network.addressType
        );
        rows.push({
          chain: network.name,
          symbol: network.symbol,
          type: network.addressType,
          path: account.hdPath,
          address: account.address,
        });
      }

      // eslint-disable-next-line no-console
      console.log('\nVidulum UTXO account 0 (abandon…about, empty passphrase)\n');
      for (const row of rows) {
        // eslint-disable-next-line no-console
        console.log(
          `${row.symbol.padEnd(5)} ${row.type.padEnd(14)} ${row.path.padEnd(22)} ${row.address}`
        );
      }

      expect(rows.length).toBeGreaterThanOrEqual(8);
      const bySymbol = Object.fromEntries(rows.map((r) => [r.symbol, r]));
      expect(bySymbol.BTC.address).toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
      expect(bySymbol.LTC.address).toBe('ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh');
      expect(bySymbol.DOGE.address).toBe('DBus3bamQjgJULBJtYXpEzDWQRwF5iwxgC');
      expect(bySymbol.RVN.address).toBe('RDjNvZL1TJQ7R8L23jDutdEioQG4eTC38V');
      expect(bySymbol.NOSO.address).toBe('XoJA8qE3N2Y3jMLEtZ3vcN42qseZ8LvFf5');
      expect(bySymbol.BTC.path).toBe("m/84'/0'/0'/0/0");
      expect(bySymbol.LTC.path).toBe("m/84'/2'/0'/0/0");
      expect(bySymbol.DOGE.path).toBe("m/44'/3'/0'/0/0");
      expect(bySymbol.ZEC.path).toBe("m/44'/133'/0'/0/0");
      expect(bySymbol.RVN.path).toBe("m/44'/175'/0'/0/0");
    });
  });

  describe('Keplr-compatible account index (documented mismatch vs BIP44 account\')', () => {
    it('account 1 is address_index 1, not BIP44 account\' 1', () => {
      // Standard Electrum/Sparrow/Ledger account 1 = m/84'/0'/1'/0/0
      // Vidulum / Keplr account 1 = m/84'/0'/0'/0/1
      expect(getUtxoDerivationPath('bitcoin-mainnet', 1, 0, false, 'p2wpkh')).toBe(
        "m/84'/0'/0'/0/1"
      );
      expect(getUtxoDerivationPath('bitcoin-mainnet', 1, 0, false, 'p2wpkh', 'bip44')).toBe(
        "m/84'/0'/1'/0/0"
      );
    });
  });

  describe('standard / other-wallet style (legacy + BIP44 account\')', () => {
    it('Bitcoin account 0 standard is BIP44 P2PKH, not native SegWit', async () => {
      const got = await deriveAddress(seed, 'bitcoin-mainnet', 'p2pkh', 0);
      expect(got.path).toBe("m/44'/0'/0'/0/0");
      expect(got.address).toBe('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
    });

    it('Keyring standard style matches Electrum legacy receive', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(MNEMONIC, 'bze', [0]);
      const account = await keyring.deriveBitcoinAccount(
        'bitcoin-mainnet',
        'mainnet',
        0,
        'p2pkh',
        'bip44'
      );
      expect(account.hdPath).toBe("m/44'/0'/0'/0/0");
      expect(account.address).toBe('1LqBGSKuX5yYUonjxT5qGfpUsXKYYWeabA');
      expect(account.address).not.toBe('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
    });
  });
});
