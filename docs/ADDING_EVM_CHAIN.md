# Adding an EVM Chain

This guide explains how to add a new EVM-compatible blockchain to The Extension Wallet.

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

### What's Missing for Transfers

To enable EVM transfers, the following would need to be implemented:

1. **Transaction building** - RLP encoding of transaction data
2. **Transaction signing** - ECDSA signing with the derived private key
3. **Nonce management** - Track and increment transaction nonces
4. **Gas estimation** - Estimate gas limits for transactions

## Prerequisites

Before adding a chain, gather the following information:

- EVM Chain ID (unique numeric identifier)
- RPC endpoint URLs (multiple for failover)
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

### Configuration Fields

| Field      | Description                             | Example                             |
| ---------- | --------------------------------------- | ----------------------------------- |
| `id`       | Unique internal identifier              | `ethereum-mainnet`                  |
| `name`     | Human-readable name                     | `Ethereum`                          |
| `chainId`  | EVM chain ID                            | `1`                                 |
| `rpcUrls`  | JSON-RPC endpoints (array for failover) | `['https://eth.llamarpc.com', ...]` |
| `symbol`   | Native token ticker                     | `ETH`                               |
| `decimals` | Token decimal places                    | `18`                                |
| `coinType` | BIP44 coin type                         | `60` (always for EVM)               |

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

## Step 4: Add Token Color

```typescript
const tokenColors: Record<string, string> = {
  // ... existing colors
  NEW: '#627EEA', // Use a distinctive hex color
};
```

## Finding EVM Chain IDs

Official resources:

- ChainList: https://chainlist.org/
- Chainid.network: https://chainid.network/

Common chain IDs:

| Chain             | Chain ID |
| ----------------- | -------- |
| Ethereum          | 1        |
| BNB Smart Chain   | 56       |
| Polygon           | 137      |
| Arbitrum One      | 42161    |
| Optimism          | 10       |
| Avalanche C-Chain | 43114    |
| Base              | 8453     |
| zkSync Era        | 324      |

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
  'newchain-mainnet': 'new_newchain', // Check MoonPay docs for correct code
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

## ERC-20 Token Support (Future)

ERC-20 tokens are **not currently supported**. The wallet only displays and transfers native EVM tokens (ETH, BNB, etc.).

### What Would Be Needed

To implement ERC-20 support, the following would be required:

#### 1. Token Registry

Add token contract addresses to `src/lib/assets/chainRegistry.ts`:

```typescript
const evmAssets: Record<string, RegistryAsset[]> = {
  'ethereum-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    // ERC-20 tokens would need contract address
    {
      symbol: 'USDC',
      name: 'USD Coin',
      denom: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Contract address as denom
      decimals: 6,
      coingeckoId: 'usd-coin',
      contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    },
  ],
};
```

#### 2. Balance Fetching

Add to `src/lib/evm/client.ts`:

```typescript
// ERC-20 ABI for balanceOf
const ERC20_BALANCE_OF = '0x70a08231';

async getERC20Balance(tokenAddress: string, walletAddress: string): Promise<bigint> {
  // Encode: balanceOf(address)
  const data = ERC20_BALANCE_OF + walletAddress.slice(2).padStart(64, '0');

  const result = await this.rpcCall<string>('eth_call', [
    { to: tokenAddress, data },
    'latest'
  ]);

  return BigInt(result);
}
```

#### 3. Token Transfers

```typescript
// ERC-20 ABI for transfer
const ERC20_TRANSFER = '0xa9059cbb';

buildERC20TransferData(recipient: string, amount: bigint): string {
  return ERC20_TRANSFER +
    recipient.slice(2).padStart(64, '0') +
    amount.toString(16).padStart(64, '0');
}
```

#### 4. Transaction Signing

The wallet would need to build and sign transactions with contract call data instead of simple value transfers.

### Implementation Complexity

| Component           | Effort | Notes                                      |
| ------------------- | ------ | ------------------------------------------ |
| Balance fetching    | Low    | Simple `eth_call`                          |
| Token registry      | Medium | Need curated token lists                   |
| Transfer UI         | Medium | Token selection, approval flows            |
| Transaction signing | High   | ABI encoding, gas estimation for contracts |
| Token approvals     | High   | ERC-20 approve/allowance pattern           |

### Recommended Approach

1. Start with a curated list of popular tokens per chain
2. Implement read-only balance display first
3. Add transfer functionality after balance display works
4. Consider using a token list standard (e.g., Uniswap token lists)

## Testnet Configuration

For testnets, create a separate configuration:

```typescript
export const NEWCHAIN_TESTNET: EvmNetworkConfig = {
  id: 'newchain-testnet',
  name: 'New Chain Testnet',
  type: 'evm',
  enabled: false, // Testnets disabled by default
  symbol: 'tNEW',
  decimals: 18,
  coinType: 60,
  chainId: 12346, // Testnet chain ID
  rpcUrls: ['https://testnet-rpc.newchain.io', 'https://testnet.publicnode.com/newchain'],
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

## Architecture Overview

The EVM implementation consists of:

| File                              | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `src/lib/networks/evm.ts`         | Network configurations                               |
| `src/lib/evm/client.ts`           | JSON-RPC client (read operations + raw tx broadcast) |
| `src/lib/crypto/evm.ts`           | Key derivation and address generation                |
| `src/lib/assets/chainRegistry.ts` | Asset definitions (native tokens only)               |

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
