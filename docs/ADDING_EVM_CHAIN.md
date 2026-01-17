# Adding an EVM Chain

This guide explains how to add a new EVM-compatible blockchain to The Extension Wallet.

## Prerequisites

Before adding a chain, gather the following information:

- EVM Chain ID (unique numeric identifier)
- RPC endpoint URL
- Native currency details (name, symbol, decimals)
- Block explorer URL

## Step 1: Define Network Configuration

Add the network configuration in `src/lib/networks/evm.ts`:

```typescript
export const NEWCHAIN_MAINNET: EvmNetworkConfig = {
  id: 'newchain-mainnet',
  name: 'New Chain',
  type: 'evm',
  enabled: true,
  symbol: 'NEW',
  decimals: 18,               // Usually 18 for EVM chains
  coinType: 60,               // Always 60 for EVM (Ethereum derivation)
  chainId: 12345,             // EVM chain ID
  rpcUrl: 'https://rpc.newchain.io',
  nativeCurrency: {
    name: 'New Token',
    symbol: 'NEW',
    decimals: 18,
  },
  explorerUrl: 'https://explorer.newchain.io',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};
```

### Configuration Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique internal identifier | `ethereum-mainnet` |
| `name` | Human-readable name | `Ethereum` |
| `chainId` | EVM chain ID | `1` |
| `rpcUrl` | JSON-RPC endpoint | `https://eth.llamarpc.com` |
| `symbol` | Native token ticker | `ETH` |
| `decimals` | Token decimal places | `18` |
| `coinType` | BIP44 coin type | `60` (always for EVM) |

### Native Currency Object

```typescript
nativeCurrency: {
  name: 'Ether',        // Full name of native token
  symbol: 'ETH',        // Token symbol
  decimals: 18,         // Always 18 for native EVM tokens
}
```

## Step 2: Register the Network

Add to the `EVM_NETWORKS` array in `src/lib/networks/evm.ts`:

```typescript
export const EVM_NETWORKS: EvmNetworkConfig[] = [
  ETHEREUM_MAINNET,
  BASE_MAINNET,
  // ... existing networks
  NEWCHAIN_MAINNET,
];
```

## Step 3: Add Asset Definition

In `src/lib/cosmos/chainRegistry.ts`, add to `evmAssets`:

```typescript
const evmAssets: Record<string, RegistryAsset[]> = {
  // ... existing assets
  'newchain-mainnet': [
    {
      symbol: 'NEW',
      name: 'New Token',
      denom: 'wei',           // Base unit (always 'wei' for EVM)
      decimals: 18,
      coingeckoId: 'newtoken', // For price data
    },
  ],
};
```

## Step 4: Add Token Color

```typescript
const tokenColors: Record<string, string> = {
  // ... existing colors
  NEW: '#627EEA',  // Use a distinctive hex color
};
```

## Finding EVM Chain IDs

Official resources:
- ChainList: https://chainlist.org/
- Chainid.network: https://chainid.network/

Common chain IDs:

| Chain | Chain ID |
|-------|----------|
| Ethereum | 1 |
| BNB Smart Chain | 56 |
| Polygon | 137 |
| Arbitrum One | 42161 |
| Optimism | 10 |
| Avalanche C-Chain | 43114 |
| Base | 8453 |
| zkSync Era | 324 |

## RPC Providers

### Public RPC Endpoints

Many chains offer public RPC endpoints. Check:
- Chain's official documentation
- https://chainlist.org/ (lists public RPCs)

### RPC Providers

For production use, consider:
- Alchemy (https://www.alchemy.com/)
- Infura (https://infura.io/)
- QuickNode (https://www.quicknode.com/)
- Ankr (https://www.ankr.com/)

## Adding MoonPay Support (Optional)

If MoonPay supports the chain, add to the mapping in `src/popup/pages/Deposit.tsx`:

```typescript
const MOONPAY_CRYPTO_CODES: Record<string, string> = {
  // ... existing codes
  'newchain-mainnet': 'new_newchain',  // Check MoonPay docs for correct code
};
```

## Testing

After adding the chain:

1. Build: `npm run build`
2. Load extension in Chrome
3. Verify network appears in EVM tab
4. Check address derivation (should be same as Ethereum)
5. Test balance fetching
6. Test sending transactions (use testnet first)

## Common Issues

### Wrong Chain ID

If transactions fail or show wrong network in wallets like MetaMask, verify the chain ID is correct.

### RPC Connection Errors

Check that:
- RPC URL is accessible
- RPC supports required methods (eth_getBalance, eth_sendRawTransaction, etc.)
- Rate limits are not exceeded

### Address Format

All EVM chains use the same address format (0x...). If addresses look wrong, check the BIP44 derivation.

## Adding ERC-20 Tokens

To add ERC-20 token support for a chain, you would need to:

1. Add token contract addresses to the asset definitions
2. Implement ERC-20 balance fetching
3. Implement ERC-20 transfer transactions

This is not currently implemented in the base wallet but can be added as a feature.

## Testnet Configuration

For testnets, create a separate configuration:

```typescript
export const NEWCHAIN_TESTNET: EvmNetworkConfig = {
  id: 'newchain-testnet',
  name: 'New Chain Testnet',
  type: 'evm',
  enabled: false,             // Disabled by default
  symbol: 'tNEW',
  decimals: 18,
  coinType: 60,
  chainId: 12346,             // Testnet chain ID
  rpcUrl: 'https://testnet-rpc.newchain.io',
  nativeCurrency: {
    name: 'Test New Token',
    symbol: 'tNEW',
    decimals: 18,
  },
  explorerUrl: 'https://testnet-explorer.newchain.io',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};
```
