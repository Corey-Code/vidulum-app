# Adding a Cosmos SDK Chain

This guide explains how to add a new Cosmos SDK-based blockchain to The Extension Wallet.

## Source of Truth: Cosmos Chain Registry

The wallet uses the **[Cosmos Chain Registry](https://github.com/cosmos/chain-registry)** as the authoritative source for chain and asset data. This community-maintained repository contains configuration for 200+ Cosmos chains.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  Cosmos Chain Registry (github.com/cosmos/chain-registry)       │
│  ├── osmosis/                                                   │
│  │   ├── chain.json      → Network config (RPC, REST, fees)    │
│  │   └── assetlist.json  → Token definitions (denoms, logos)   │
│  ├── cosmoshub/                                                 │
│  └── ... 200+ chains                                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    npm run sync:chains
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Generated Wallet Config                                         │
│  ├── src/lib/networks/cosmos-registry.ts  (chain configs)       │
│  └── src/lib/assets/cosmos-registry.ts    (asset definitions)   │
└─────────────────────────────────────────────────────────────────┘
```

## Method 1: Add Chain to Cosmos Chain Registry (Recommended)

If the chain isn't already in the registry, **submit a PR to the Cosmos Chain Registry first**:

1. Fork [cosmos/chain-registry](https://github.com/cosmos/chain-registry)
2. Create a directory for your chain (e.g., `mychain/`)
3. Add `chain.json` with network configuration
4. Add `assetlist.json` with token definitions
5. Submit a PR following their [contribution guidelines](https://github.com/cosmos/chain-registry#contributing)

Once merged, run the sync script to pull the chain into the wallet:

```bash
# Sync your chain (and other defaults)
npm run sync:chains -- --chains mychain,osmosis,cosmoshub

# Or add to the DEFAULT_CHAINS in scripts/sync-chain-registry.ts
# then run:
npm run sync:chains
```

### Chain Registry File Format

**chain.json** (required fields):

```json
{
  "chain_name": "mychain",
  "chain_id": "mychain-1",
  "pretty_name": "My Chain",
  "status": "live",
  "network_type": "mainnet",
  "bech32_prefix": "mychain",
  "slip44": 118,
  "fees": {
    "fee_tokens": [
      {
        "denom": "umytoken",
        "average_gas_price": 0.025
      }
    ]
  },
  "apis": {
    "rpc": [
      { "address": "https://rpc.mychain.io", "provider": "MyChain" },
      { "address": "https://mychain-rpc.polkachu.com", "provider": "Polkachu" }
    ],
    "rest": [
      { "address": "https://api.mychain.io", "provider": "MyChain" },
      { "address": "https://mychain-api.polkachu.com", "provider": "Polkachu" }
    ]
  },
  "explorers": [
    {
      "kind": "mintscan",
      "url": "https://www.mintscan.io/mychain",
      "tx_page": "https://www.mintscan.io/mychain/tx/${txHash}",
      "account_page": "https://www.mintscan.io/mychain/account/${accountAddress}"
    }
  ]
}
```

**assetlist.json**:

```json
{
  "chain_name": "mychain",
  "assets": [
    {
      "denom_units": [
        { "denom": "umytoken", "exponent": 0 },
        { "denom": "mytoken", "exponent": 6 }
      ],
      "base": "umytoken",
      "name": "My Token",
      "display": "mytoken",
      "symbol": "MYT",
      "logo_URIs": {
        "png": "https://raw.githubusercontent.com/cosmos/chain-registry/master/mychain/images/mytoken.png"
      },
      "coingecko_id": "my-token"
    }
  ]
}
```

## Method 2: Dynamic Runtime Fetching

For chains in the registry but not pre-bundled, users can enable them at runtime:

```typescript
import { chainRegistryClient } from '@/lib/networks';

// Fetch chain config dynamically
const chain = await chainRegistryClient.fetchChain('juno');

// Search available chains
const results = await chainRegistryClient.searchChains('terra');

// Get list of all available chains
const available = await chainRegistryClient.getAvailableChains();
```

The dynamic client:

- Fetches from the chain registry on-demand
- Caches results in `browser.storage.local` for 24 hours
- Works for any chain in the registry
- Filters out retired public hosts (QuickApi, Lava public RPC, Whispernode,
  Notional cosmosia, leftover dYdX Polkachu dao hosts, leftover Injective
  Polkachu RPC/LCD hops, leftover Kujira / Stargaze RPC/LCD hops, leftover
  Evmos RPC/LCD hops, leftover official Neutron RPC/LCD hops, leftover
  ezstaking.dev / itastakers / setten.io hops, and others). See
  `src/lib/networks/cosmos-endpoints.ts`.

## Method 3: Manual Configuration (Legacy)

For chains not in the registry, or for custom/private networks, you can still add manual configurations.

### Step 1: Define Network Configuration

Add the network configuration in `src/lib/networks/cosmos.ts`:

```typescript
export const NEW_CHAIN_MAINNET: CosmosNetworkConfig = {
  id: 'newchain-1',
  name: 'New Chain',
  type: 'cosmos',
  enabled: true,
  symbol: 'NEW',
  decimals: 6,
  coinType: 118,
  rpc: ['https://rpc.newchain.io', 'https://rpc-2.newchain.io'],
  rest: ['https://api.newchain.io', 'https://api-2.newchain.io'],
  bech32Prefix: 'new',
  feeDenom: 'unew',
  gasPrice: '0.025',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://explorer.newchain.io',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Prefer Mintscan, ATOMScan, or a live official explorer. Do not add retired
// leftover hosts such as ezstaking.app (account 404), finder.kujira.app (403),
// or explorers.guru (404 / DNS-dead). Mintscan dropped Juno and Kujira.

// Register in the networks array
export const COSMOS_NETWORKS: CosmosNetworkConfig[] = [
  // ... existing networks
  NEW_CHAIN_MAINNET,
];
```

### Step 2: Add Fallback Assets

In `src/lib/assets/chainRegistry.ts`:

```typescript
const chainNameMap: Record<string, string> = {
  // ... existing mappings
  'newchain-1': 'newchain',
};

const fallbackAssets: Record<string, RegistryAsset[]> = {
  // ... existing assets
  'newchain-1': [
    {
      symbol: 'NEW',
      name: 'New Chain',
      denom: 'unew',
      decimals: 6,
      coingeckoId: 'newchain',
    },
  ],
};
```

## Configuration Reference

### Network Config Fields

| Field          | Description                                   | Example                               |
| -------------- | --------------------------------------------- | ------------------------------------- |
| `id`           | Chain ID (unique identifier)                  | `cosmoshub-4`                         |
| `name`         | Human-readable name                           | `Cosmos Hub`                          |
| `symbol`       | Native token ticker                           | `ATOM`                                |
| `decimals`     | Token decimal places                          | `6`                                   |
| `coinType`     | BIP44 coin type                               | `118`                                 |
| `rpc`          | Tendermint RPC endpoints (array for failover) | `['https://rpc.cosmos.network', ...]` |
| `rest`         | REST/LCD API endpoints (array for failover)   | `['https://api.cosmos.network', ...]` |
| `bech32Prefix` | Address prefix                                | `cosmos`                              |
| `feeDenom`     | Fee token denomination                        | `uatom`                               |
| `gasPrice`     | Default gas price                             | `0.025`                               |
| `features`     | Supported features array                      | See below                             |

### Features Array

- `stargate` - Stargate-compatible chain (most modern chains)
- `ibc-transfer` - IBC token transfers supported
- `no-legacy-stdTx` - Uses new transaction format
- `cosmwasm` - CosmWasm smart contracts (if supported)

### Endpoint Failover

The wallet automatically handles endpoint failover:

- Endpoints are tried in order of preference
- Failed endpoints are temporarily marked unhealthy
- Healthy endpoints are preferred for subsequent requests
- Include at least 2-3 endpoints for reliability

**Recommended RPC providers:**

- [Polkachu](https://polkachu.com/public_rpc)
- [Lavender.Five](https://www.lavenderfive.com/)
- [PublicNode](https://publicnode.com/)
- Chain's official endpoints

The sync script and runtime client both drop retired public hosts listed in
`src/lib/networks/cosmos-endpoints.ts` so a later registry pull does not
reintroduce QuickApi, Lava public RPC, Whispernode, Notional cosmosia,
leftover dYdX Polkachu dao hosts (`dydx-dao-rpc.polkachu.com` /
`dydx-dao-api.polkachu.com`; official registry now lists
`dydx-rpc.polkachu.com` / `dydx-api.polkachu.com`), leftover Injective
Polkachu hops (`injective-rpc.polkachu.com` /
`injective-api.polkachu.com` timeout), leftover Kujira hops
(`lavenderfive.com:443/kujira` 503; Kleomedes 525; Polkachu DNS-dead),
leftover Stargaze hops (chain-registry kill;
`lavenderfive.com:443/stargaze` 503; Kleomedes empty 200), leftover
Autostake 404 hops, leftover Evmos hops (`lavenderfive.com:443/evmos`
503 after the chain-registry kill; `goldenratiostaking.net` /
`owallet.io` 502; `w3coins.io` / `stakeflow.io` DNS-dead), leftover
official Neutron hops (`rpc-lb.neutron.org` / `rest-lb.neutron.org` HTML
302, `rest-*.neutron-1.neutron.org` TLS handshake failure),
`ezstaking.dev` (Cloudflare 521), `itastakers.com` (DNS-dead),
`setten.io` (TLS hostname mismatch), `ezstaking.app` (account 404),
`finder.kujira.app` (403), or `explorers.guru` (404 / DNS-dead).

## Sync Script Reference

```bash
# Sync default chains (defined in DEFAULT_CHAINS)
npm run sync:chains

# Sync specific chains
npm run sync:chains -- --chains osmosis,juno,stargaze

# View available chains
# Check: https://github.com/cosmos/chain-registry (directory names)
```

The sync script generates:

- `src/lib/networks/cosmos-registry.ts` - Chain configurations
- `src/lib/assets/cosmos-registry.ts` - Asset definitions with logos
- `src/lib/assets/ibc-registry.ts` - IBC channel metadata

Retired-host filtering lives in `src/lib/networks/cosmos-endpoints.ts`.

## Testing

After adding a chain:

1. Run `npm run sync:chains` (if using registry method)
2. Build the extension: `npm run build`
3. Load the unpacked extension in Chrome
4. Verify the network appears in the network selector
5. Test address derivation
6. Test balance fetching
7. Test sending transactions (on testnet first if available)

## Troubleshooting

### Chain Not Appearing

- Ensure the chain has `status: "live"` and `network_type: "mainnet"` in the registry
- Check the sync script output for errors
- Verify the chain name matches the registry directory

### Balance Not Loading

- Check that REST endpoints are accessible
- Verify the `feeDenom` matches the chain's actual fee token

### Wrong Address Format

- Ensure `bech32_prefix` is correct in the chain registry
- Check `slip44` coin type matches (118 for most Cosmos chains)

## Resources

- **[Cosmos Chain Registry](https://github.com/cosmos/chain-registry)** - Source of truth for chain data
- [Chain Registry NPM Package](https://www.npmjs.com/package/chain-registry) - TypeScript types and utilities
- [BIP44 Coin Types](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)
- [Cosmos SDK Documentation](https://docs.cosmos.network/)