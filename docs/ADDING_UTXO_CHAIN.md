# Adding a UTXO Chain (Bitcoin-like)

This guide explains how to add a new UTXO-based blockchain (Bitcoin, Litecoin, etc.) to The Extension Wallet.

## Prerequisites

Before adding a chain, gather the following information:

- BIP44 coin type number
- Address version bytes (pubKeyHash, scriptHash)
- Bech32 prefix (if SegWit supported)
- WIF version byte
- Block explorer API URL
- Address format type

## Step 1: Define Network Configuration

Add the network configuration in `src/lib/networks/bitcoin.ts`:

```typescript
export const NEWCOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'newcoin-mainnet',
  name: 'New Coin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'NEW',
  decimals: 8,                    // Usually 8 for UTXO chains
  coinType: 123,                  // BIP44 coin type (unique per chain)
  network: 'mainnet',
  apiUrl: 'https://api.newcoin.io/api',
  addressType: 'p2pkh',           // See address types below
  addressPrefix: {
    pubKeyHash: 0x00,             // Version byte for P2PKH addresses
    scriptHash: 0x05,             // Version byte for P2SH addresses
    bech32: 'nc',                 // Bech32 HRP (optional, for SegWit)
  },
  explorerUrl: 'https://explorer.newcoin.io',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};
```

### Address Types

| Type | Description | Example Addresses |
|------|-------------|-------------------|
| `p2wpkh` | Native SegWit | bc1q..., ltc1... |
| `p2sh-p2wpkh` | Nested SegWit | 3..., M... |
| `p2pkh` | Legacy | 1..., L..., D..., R... |
| `transparent` | Zcash-style transparent | t1... |

### Address Prefix Formats

For most chains (single-byte prefix):

```typescript
addressPrefix: {
  pubKeyHash: 0x00,   // Single byte
  scriptHash: 0x05,
  bech32: 'bc',       // Optional
}
```

For Zcash-style chains (two-byte prefix):

```typescript
addressPrefix: {
  pubKeyHash: 0x1cb8, // Two bytes (or as array: [0x1c, 0xb8])
  scriptHash: 0x1cbd,
}
```

## Step 2: Register the Network

Add to the `BITCOIN_NETWORKS` array in `src/lib/networks/bitcoin.ts`:

```typescript
export const BITCOIN_NETWORKS: BitcoinNetworkConfig[] = [
  BITCOIN_MAINNET,
  LITECOIN_MAINNET,
  // ... existing networks
  NEWCOIN_MAINNET,
];
```

## Step 3: Add Address Generation Parameters

In `src/lib/crypto/bitcoin.ts`, add to the `UTXO_CHAIN_PARAMS` object:

```typescript
export const UTXO_CHAIN_PARAMS = {
  // ... existing chains
  'newcoin-mainnet': {
    name: 'New Coin',
    bech32: 'nc',           // Optional, only if SegWit supported
    pubKeyHash: 0x00,       // P2PKH version byte
    scriptHash: 0x05,       // P2SH version byte
    wif: 0x80,              // WIF version byte
    coinType: 123,          // BIP44 coin type
  },
};
```

For Zcash-style chains:

```typescript
'zcash-mainnet': {
  name: 'Zcash',
  pubKeyHash: [0x1c, 0xb8],   // Two-byte prefix as array
  scriptHash: [0x1c, 0xbd],
  wif: 0x80,
  coinType: 133,
},
```

## Step 4: Add Asset Definition

In `src/lib/cosmos/chainRegistry.ts`, add to `bitcoinAssets`:

```typescript
const bitcoinAssets: Record<string, RegistryAsset[]> = {
  // ... existing assets
  'newcoin-mainnet': [
    {
      symbol: 'NEW',
      name: 'New Coin',
      denom: 'newatoshi',     // Base unit name (smallest denomination)
      decimals: 8,
      coingeckoId: 'newcoin', // For price data
    },
  ],
};
```

## Step 5: Add Token Color

```typescript
const tokenColors: Record<string, string> = {
  // ... existing colors
  NEW: '#F7931A',  // Use a distinctive hex color
};
```

## Finding Chain Parameters

### BIP44 Coin Types

Official registry: https://github.com/satoshilabs/slips/blob/master/slip-0044.md

Common coin types:

| Chain | Coin Type |
|-------|-----------|
| Bitcoin | 0 |
| Litecoin | 2 |
| Dogecoin | 3 |
| Dash | 5 |
| Zcash | 133 |
| Ravencoin | 175 |
| BitcoinZ | 177 |

### Address Version Bytes

Common prefixes:

| Chain | pubKeyHash | scriptHash | Bech32 |
|-------|------------|------------|--------|
| Bitcoin | 0x00 | 0x05 | bc |
| Litecoin | 0x30 | 0x32 | ltc |
| Dogecoin | 0x1e | 0x16 | - |
| Ravencoin | 0x3c | 0x7a | - |
| Zcash | 0x1cb8 | 0x1cbd | - |

### Finding Parameters for Unknown Chains

1. Check the chain's source code (usually in `chainparams.cpp` or similar)
2. Look for `base58Prefixes` array
3. Search chain documentation or developer resources

## API Requirements

The wallet expects a Blockstream/Mempool-style API. Required endpoints:

```
GET /address/{address}              - Get address info
GET /address/{address}/utxo         - Get UTXOs
GET /tx/{txid}                      - Get transaction
POST /tx                            - Broadcast transaction
GET /fee-estimates                  - Get fee rates (optional)
```

If the chain uses a different API format, you may need to add an adapter in `src/lib/bitcoin/client.ts`.

## Testing

After adding the chain:

1. Build: `npm run build`
2. Load extension in Chrome
3. Verify network appears in UTXO tab
4. Check address format is correct
5. Test balance fetching (if API available)
6. Test with testnet first if possible

## Common Issues

### Wrong Address Format

Check that `addressType` matches your configuration:
- SegWit chains: use `p2wpkh` and ensure `bech32` is set
- Legacy chains: use `p2pkh`
- Zcash-forks: use `transparent` with two-byte prefix

### Address Derivation Errors

Verify the `coinType` matches the BIP44 specification for the chain.

### API Compatibility

Not all block explorers provide compatible APIs. You may need to:
- Find a compatible API provider
- Add custom API handling in the client code
