# Adding an EVM Chain

This guide explains how to add a new EVM-compatible blockchain to The Extension Wallet.

## Source of Truth

The wallet uses **[ethereum-lists/chains](https://github.com/ethereum-lists/chains)** as the primary source of truth for EVM chain configurations, available at [chainid.network](https://chainid.network/chains.json).

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ethereum-lists/chains                            │
│              https://chainid.network/chains.json                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────────┐                ┌─────────────────────────────┐
│   BUILD TIME        │                │   RUNTIME                   │
│   sync-evm-         │                │   evm-registry-client.ts    │
│   registry.ts       │                │                             │
└─────────┬───────────┘                │   • Fetch on-demand         │
          │                            │   • Cache in chrome.storage │
          ▼                            │   • 24-hour TTL             │
┌─────────────────────┐                └─────────────────────────────┘
│ evm-registry.ts     │
│ (pre-bundled)       │
└─────────────────────┘
```

## Current EVM Support

The wallet has **partial EVM support** - read operations work, but sending is not yet implemented:

| Feature                 | Status             | Notes                               |
| ----------------------- | ------------------ | ----------------------------------- |
| Key derivation (BIP44)  | ✅ Supported       | `m/44'/60'/0'/0/index` path         |
| Address generation      | ✅ Supported       | EIP-55 checksummed addresses        |
| Native token balance    | ✅ Supported       | Via `eth_getBalance`                |
| EIP-1559 gas estimation | ✅ Supported       | Via `eth_gasPrice` + block base fee |
| Native token transfers  | ⏳ Planned         | Transaction signing not implemented |
| Transaction signing     | ❌ Not implemented | Required for any send operation     |
| ERC-20 tokens           | ❌ Not implemented | No contract interaction support     |
| ERC-721/1155 NFTs       | ❌ Not implemented | No contract interaction support     |

### What Works Now

- **View balances** - Native token balances display correctly
- **Receive tokens** - Addresses are valid and can receive tokens
- **Network switching** - Multiple EVM networks supported

---

## Method 1: Add Chain to ethereum-lists/chains (Recommended)

If the chain is not already in the registry, contribute to the upstream source:

1. **Fork** [ethereum-lists/chains](https://github.com/ethereum-lists/chains)
2. **Add chain data** following their [schema](https://github.com/ethereum-lists/chains#schema)
3. **Submit PR** to the main repository
4. **Wait for merge** and data propagation to chainid.network
5. **Update wallet** by running `npm run sync:evm`

This approach ensures the chain is available to the entire ecosystem.

## Method 2: Dynamic Runtime Fetching

For chains already in the registry but not pre-bundled:

```typescript
import { evmRegistryClient } from '@/lib/networks';

// Fetch a specific chain by ID
const chain = await evmRegistryClient.fetchChain(137); // Polygon

// Search for chains
const results = await evmRegistryClient.searchChains('polygon');

// Get popular chains
const popular = await evmRegistryClient.getPopularChains();
```

The runtime client:

- Fetches chain data from chainid.network
- Caches results in `browser.storage.local` for 24 hours
- Filters out deprecated chains and invalid RPC endpoints

## Method 3: Manual Configuration (Legacy)

For chains not in the registry, or when you need full control:

### Step 1: Define Network Configuration

Add the network configuration in `src/lib/networks/evm.ts`:

```typescript
export const NEWCHAIN_MAINNET: EvmNetworkConfig = {
  id: 'newchain-mainnet',
  name: 'New Chain',
  type: 'evm',
  enabled: true,
  symbol: 'NEW',
  decimals: 18, // Usually 18 for EVM chains
  coinType: 60, // Always 60 for EVM (Ethereum derivation)
  chainId: 12345, // EVM chain ID
  rpcUrls: [
    // Multiple URLs for failover (in order of preference)
    'https://rpc.newchain.io',
    'https://rpc2.newchain.io',
    'https://rpc.ankr.com/newchain',
  ],
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

### Step 2: Register the Network

Add to the `EVM_NETWORKS` array:

```typescript
export const EVM_NETWORKS: EvmNetworkConfig[] = [
  ETHEREUM_MAINNET,
  BASE_MAINNET,
  // ... existing networks
  NEWCHAIN_MAINNET,
];
```

### Step 3: Add Asset Definition

In `src/lib/assets/chainRegistry.ts`, add to `evmAssets`:

```typescript
const evmAssets: Record<string, RegistryAsset[]> = {
  // ... existing assets
  'newchain-mainnet': [
    {
      symbol: 'NEW',
      name: 'New Token',
      denom: 'wei', // Base unit (always 'wei' for EVM)
      decimals: 18,
      coingeckoId: 'newtoken', // For price data
    },
  ],
};
```

---

## Configuration Reference

### EvmNetworkConfig Interface

```typescript
interface EvmNetworkConfig {
  id: string; // Unique internal identifier
  name: string; // Human-readable name
  type: 'evm'; // Network type
  enabled: boolean; // Whether enabled by default
  symbol: string; // Native token symbol
  decimals: number; // Native token decimals (usually 18)
  coinType: number; // BIP44 coin type (always 60 for EVM)
  chainId: number; // EVM chain ID
  rpcUrls: string[]; // JSON-RPC endpoints (array for failover)
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl?: string; // Block explorer base URL
  explorerAccountPath?: string; // Path for addresses (use {address})
  explorerTxPath?: string; // Path for transactions (use {txHash})
}
```

### EvmRegistryConfig (Extended)

The registry adds extra fields:

```typescript
interface EvmRegistryConfig extends EvmNetworkConfig {
  shortName: string; // Registry short name for lookups
  infoUrl?: string; // Chain info URL
  isTestnet?: boolean; // Whether this is a testnet
}
```

---

## Syncing from Chain Registry

### Update Pre-bundled Chains

```bash
# Sync default popular chains (~25 chains)
npm run sync:evm

# Sync all chains with valid RPC endpoints
npm run sync:evm:all

# Sync specific chains by ID
npx ts-node --esm scripts/sync-evm-registry.ts --chains 1,56,137,8453
```

### Pre-bundled Chains

The following chains are pre-bundled by default:

| Chain             | Chain ID | Enabled |
| ----------------- | -------- | ------- |
| Ethereum          | 1        | ✅      |
| OP Mainnet        | 10       | ✅      |
| BNB Smart Chain   | 56       | ✅      |
| Polygon           | 137      | ✅      |
| Base              | 8453     | ✅      |
| Arbitrum One      | 42161    | ✅      |
| Cronos            | 25       | ☐       |
| Gnosis            | 100      | ☐       |
| Fantom            | 250      | ☐       |
| zkSync Era        | 324      | ☐       |
| Polygon zkEVM     | 1101     | ☐       |
| Moonbeam          | 1284     | ☐       |
| Mantle            | 5000     | ☐       |
| Avalanche C-Chain | 43114    | ☐       |
| Linea             | 59144    | ☐       |
| Blast             | 81457    | ☐       |
| Scroll            | 534352   | ☐       |
| Zora              | 7777777  | ☐       |
| Sepolia (testnet) | 11155111 | ☐       |
| Base Sepolia      | 84532    | ☐       |

---

## Finding EVM Chain Information

### Official Resources

- **ChainList**: https://chainlist.org/
- **Chainid.network**: https://chainid.network/
- **Chain Registry**: https://github.com/ethereum-lists/chains

### RPC Providers

For production use, consider these providers:

- Alchemy (https://www.alchemy.com/)
- Infura (https://infura.io/)
- QuickNode (https://www.quicknode.com/)
- Ankr (https://www.ankr.com/)

---

## Architecture Overview

The EVM implementation consists of:

| File                                      | Purpose                                    |
| ----------------------------------------- | ------------------------------------------ |
| `src/lib/networks/evm.ts`                 | Manual network configurations              |
| `src/lib/networks/evm-registry.ts`        | Auto-generated from chain registry         |
| `src/lib/networks/evm-registry-client.ts` | Runtime client for dynamic fetching        |
| `src/lib/evm/client.ts`                   | JSON-RPC client (read ops + raw broadcast) |
| `src/lib/crypto/evm.ts`                   | Key derivation and address generation      |
| `src/lib/assets/chainRegistry.ts`         | Asset definitions (native tokens only)     |
| `scripts/sync-evm-registry.ts`            | Build-time sync script                     |

### EVM Client Capabilities

The `EvmClient` class provides:

```typescript
// Read operations (implemented)
getBalance(address); // Get native token balance
getGasPrice(); // Get current gas price
getFeeData(); // Get EIP-1559 fee data
getTransactionCount(address); // Get nonce
estimateGas(tx); // Estimate gas for transaction
getTransaction(txHash); // Get transaction by hash
getTransactionReceipt(txHash); // Get transaction receipt
getBlockNumber(); // Get current block number
getChainId(); // Get chain ID

// Write operations (partially implemented)
sendRawTransaction(signedTx); // Broadcast pre-signed transaction
```

**Note:** `sendRawTransaction` requires an already-signed transaction. Transaction building and signing are not yet implemented.

### Key Derivation

All EVM chains use the same derivation path: `m/44'/60'/0'/0/index`

This means the same private key/address works across all EVM chains. The wallet derives keys using:

1. BIP39 mnemonic → seed
2. BIP32 derivation with coin type 60
3. Keccak256 hash of public key → address
4. EIP-55 checksum formatting

---

## ERC-20 Token Support (Future)

ERC-20 tokens are **not currently supported**. The wallet only displays native EVM tokens (ETH, BNB, etc.).

### What Would Be Needed

To implement ERC-20 support, the following would be required:

1. **Token Registry** - Contract addresses per chain
2. **Balance Fetching** - `eth_call` with `balanceOf` selector
3. **Token Transfers** - ABI encoding for `transfer` function
4. **Transaction Signing** - Full transaction building/signing

### Implementation Complexity

| Component           | Effort | Notes                                      |
| ------------------- | ------ | ------------------------------------------ |
| Balance fetching    | Low    | Simple `eth_call`                          |
| Token registry      | Medium | Need curated token lists                   |
| Transfer UI         | Medium | Token selection, approval flows            |
| Transaction signing | High   | ABI encoding, gas estimation for contracts |
| Token approvals     | High   | ERC-20 approve/allowance pattern           |

---

## Troubleshooting

### RPC Connection Errors

- Verify RPC URL is accessible
- Check that RPC supports required methods
- Ensure rate limits are not exceeded
- Try alternative endpoints from the failover list

### Wrong Chain ID

If transactions fail or show wrong network, verify the chain ID matches the registry.

### Address Format

All EVM chains use the same address format (0x...). If addresses look wrong, check the BIP44 derivation.

### Missing from Registry

If a chain isn't in ethereum-lists/chains:

1. Check if it's a new chain (may take time to be added)
2. Submit a PR to add it
3. Use manual configuration as a temporary workaround
