# Adding an SVM Chain (Solana-like)

This guide explains how to add a new Solana Virtual Machine (SVM) network to Vidulum App. Use it for Solana clusters or SVM-compatible chains such as Eclipse.

For the full process of introducing a brand-new network type, see [Adding a Network Type](ADDING_NETWORK_TYPE.md).

## Current SVM Support

Solana mainnet is enabled. Devnet, testnet, and Eclipse are defined but disabled by default.

| Feature                | Status       | Notes                                      |
| ---------------------- | ------------ | ------------------------------------------ |
| Address display        | Supported    | Shown on the dashboard SVM tab             |
| Native SOL balance     | Supported    | Via JSON-RPC `getBalance`                  |
| Explorer links         | Supported    | Solana Explorer / Eclipse Scan             |
| Extra SVM mainnets     | Config-only  | Add a config entry and enable when ready   |

## Step 1: Define Network Configuration

Add the network in `src/lib/networks/solana.ts` and include it in `SVM_NETWORKS`.

```typescript
export const NEW_SVM_MAINNET: SvmNetworkConfig = {
  id: 'newsvm-mainnet',
  name: 'New SVM',
  type: 'svm',
  enabled: true,
  symbol: 'NEWS',
  decimals: 9,
  coinType: 501,
  cluster: 'mainnet',
  isMainnet: true,
  rpcUrls: [
    'https://rpc.newsvm.example',
    'https://backup-rpc.newsvm.example',
  ],
  logoUrl: 'https://example.com/newsvm.png',
  explorerUrl: 'https://explorer.newsvm.example',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};
```

### Configuration Fields

| Field        | Description                         | Example              |
| ------------ | ----------------------------------- | -------------------- |
| `id`         | Unique network identifier           | `solana-mainnet`     |
| `name`       | Human-readable name                 | `Solana`             |
| `symbol`     | Native token ticker                 | `SOL`                |
| `decimals`   | Native token decimals               | `9`                  |
| `coinType`   | BIP44 coin type                     | `501`                |
| `cluster`    | SVM cluster label                   | `mainnet-beta`       |
| `rpcUrls`    | RPC endpoints, failover order       | public HTTPS RPCs    |
| `enabled`    | Whether users see the network       | `true` for mainnets  |

Use more than one public HTTPS RPC so failover can skip a dead host. Do not add retired or key-gated endpoints such as Project Serum, Ankr public RPC (`rpc.ankr.com`), Solana dRPC, or Lava's discontinued Solana host.

## Step 2: Register and Advertise

1. Confirm the new config is exported from `src/lib/networks/solana.ts` and included in `SVM_NETWORKS`.
2. The unified registry in `src/lib/networks/registry.ts` already registers every SVM config.
3. If the network should appear in Settings and the README supported-network list, add it to `src/lib/networks/supported-catalog.ts`.
4. Add or update tests in `tests/lib/networks/registry.test.ts` and `tests/lib/networks/supported-catalog.test.ts`.

## Step 3: Verify

```bash
npm test -- tests/lib/networks
npm run lint
```

Then run the web app or extension, open Settings, and confirm the network family list still matches what you advertised.

## Related Files

- `src/lib/networks/solana.ts` — SVM network configs
- `src/lib/networks/svm-endpoints.ts` — public-RPC denylist and filters
- `src/lib/networks/supported-catalog.ts` — curated user-facing list
- `src/lib/solana/client.ts` — JSON-RPC balance and account reads
- `src/popup/components/SupportedNetworksPanel.tsx` — Settings summary
