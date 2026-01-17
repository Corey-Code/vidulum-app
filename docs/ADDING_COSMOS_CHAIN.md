# Adding a Cosmos SDK Chain

This guide explains how to add a new Cosmos SDK-based blockchain to The Extension Wallet.

## Prerequisites

Before adding a chain, gather the following information:

- Chain ID (e.g., `cosmoshub-4`)
- RPC endpoint URL
- REST/LCD endpoint URL
- Bech32 address prefix (e.g., `cosmos`)
- Native token symbol and denomination
- Block explorer URL

## Step 1: Define Network Configuration

Add the network configuration in `src/lib/networks/cosmos.ts`:

```typescript
export const NEW_CHAIN_MAINNET: CosmosNetworkConfig = {
  id: 'newchain-1',           // Chain ID
  name: 'New Chain',          // Display name
  type: 'cosmos',
  enabled: true,
  symbol: 'NEW',              // Native token symbol
  decimals: 6,                // Native token decimals (usually 6)
  coinType: 118,              // BIP44 coin type (118 for most Cosmos chains)
  rpc: 'https://rpc.newchain.io',
  rest: 'https://api.newchain.io',
  bech32Prefix: 'new',        // Address prefix
  feeDenom: 'unew',           // Fee denomination (micro-denom)
  gasPrice: '0.025',          // Default gas price
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://explorer.newchain.io',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/tx/{txHash}',
};
```

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique chain identifier | `cosmoshub-4` |
| `name` | Human-readable name | `Cosmos Hub` |
| `symbol` | Native token ticker | `ATOM` |
| `decimals` | Token decimal places | `6` |
| `coinType` | BIP44 coin type | `118` |
| `rpc` | Tendermint RPC endpoint | `https://rpc.cosmos.network` |
| `rest` | REST/LCD API endpoint | `https://api.cosmos.network` |
| `bech32Prefix` | Address prefix | `cosmos` |
| `feeDenom` | Fee token denomination | `uatom` |
| `gasPrice` | Default gas price | `0.025` |
| `features` | Supported features array | See below |

### Features Array

Common features to include:

- `stargate` - Stargate-compatible chain (most modern chains)
- `ibc-transfer` - IBC token transfers supported
- `no-legacy-stdTx` - Uses new transaction format
- `cosmwasm` - CosmWasm smart contracts (if supported)

## Step 2: Register the Network

Add the new network to the `COSMOS_NETWORKS` array in `src/lib/networks/cosmos.ts`:

```typescript
export const COSMOS_NETWORKS: CosmosNetworkConfig[] = [
  BEEZEE_MAINNET,
  OSMOSIS_MAINNET,
  // ... existing networks
  NEW_CHAIN_MAINNET,  // Add your new chain
];
```

## Step 3: Add Chain Registry Mapping

In `src/lib/cosmos/chainRegistry.ts`, add the chain name mapping:

```typescript
const chainNameMap: Record<string, string> = {
  'beezee-1': 'beezee',
  'osmosis-1': 'osmosis',
  // ... existing mappings
  'newchain-1': 'newchain',  // Maps to cosmos/chain-registry folder name
};
```

This mapping is used to fetch assets from the Cosmos Chain Registry.

## Step 4: Add Fallback Assets

If the chain is not in the Cosmos Chain Registry, or you want to ensure specific assets are always available:

```typescript
const fallbackAssets: Record<string, RegistryAsset[]> = {
  // ... existing assets
  'newchain-1': [
    { 
      symbol: 'NEW', 
      name: 'New Chain', 
      denom: 'unew', 
      decimals: 6,
      coingeckoId: 'newchain'  // Optional, for price data
    },
    // Add IBC tokens if needed
    {
      symbol: 'ATOM',
      name: 'Cosmos Hub',
      denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
      decimals: 6,
    },
  ],
};
```

## Step 5: Add Token Color

Add a color for the token in the `tokenColors` map:

```typescript
const tokenColors: Record<string, string> = {
  // ... existing colors
  NEW: '#3B82F6',  // Use a distinctive hex color
};
```

## Step 6: Enable Staking (Optional)

If you want staking support, add the chain to the REStake mapping in `src/popup/pages/Staking.tsx`:

```typescript
function getRestakeChainName(chainId: string): string {
  const mapping: Record<string, string> = {
    // ... existing mappings
    'newchain-1': 'newchain',
  };
  return mapping[chainId] || chainId.split('-')[0];
}
```

Also update the Dashboard staking menu to include the new chain.

## Testing

After adding the chain:

1. Build the extension: `npm run build`
2. Load the unpacked extension in Chrome
3. Verify the network appears in the network selector
4. Test address derivation
5. Test balance fetching
6. Test sending transactions (on testnet first if available)

## Common Issues

### Wrong Address Format

Ensure `bech32Prefix` matches the chain's expected address prefix.

### Balance Not Loading

Check that the REST endpoint is accessible and returns data in the expected format.

### Transaction Failures

Verify `feeDenom` and `gasPrice` are correct for the chain.

## Resources

- [Cosmos Chain Registry](https://github.com/cosmos/chain-registry)
- [Chain Registry NPM Package](https://www.npmjs.com/package/chain-registry)
- [BIP44 Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
