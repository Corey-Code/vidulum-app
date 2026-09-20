# Vidulum App

Free Open-Source multi-chain wallet built by the people, for the people.

Available as:

- **Browser Extension** - Chrome, Firefox, Edge
- **Web App** - [vidulum.app](https://vidulum.app)

- [Purpose](PURPOSE.md) - Project mission and core principles
- [Privacy Policy](PRIVACY_POLICY.md) - No data collection, all storage is local
- [Terms of Use](TERMS_OF_USE.md) - Non-custodial wallet, user responsibilities

## Supported Networks

### Cosmos SDK Chains

Cosmos networks are sourced from the [Cosmos Chain Registry](https://github.com/cosmos/chain-registry). Advertised Cosmos networks load balances through current public RPC and LCD hosts (CryptoCrew, Lavender.Five, Polkachu, PublicNode, and official chain endpoints). Retired leftover dYdX Polkachu dao hosts (dydx-dao-rpc.polkachu.com / dydx-dao-api.polkachu.com) were replaced with current dydx-rpc.polkachu.com hops. Earlier leftover Injective Polkachu hops (timeout), leftover Kujira and Stargaze hops, Autostake 404 hops, Evmos, official Neutron, ezstaking.dev, itastakers.com, and setten.io hops stay denylisted. Explorer links use current hosts (Mintscan, ATOMScan, BeeZee Explorer). Retired leftover explorers such as ezstaking.app, finder.kujira.app, and explorers.guru were removed.

| Network    | Chain ID    | Symbol | Status  |
| ---------- | ----------- | ------ | ------- |
| BeeZee     | beezee-1    | BZE    | Enabled |
| Osmosis    | osmosis-1   | OSMO   | Enabled |
| AtomOne    | atomone-1   | ATONE  | Enabled |
| Cosmos Hub | cosmoshub-4 | ATOM   | Enabled |

[View full list of Cosmos chains](https://github.com/cosmos/chain-registry)

### UTXO Chains (Bitcoin-like)

| Network   | Network ID        | Symbol | Address Format      | Status  |
| --------- | ----------------- | ------ | ------------------- | ------- |
| Bitcoin   | bitcoin-mainnet   | BTC    | bc1... (SegWit)     | Enabled |
| Litecoin  | litecoin-mainnet  | LTC    | ltc1... (SegWit)    | Enabled |
| Dogecoin  | dogecoin-mainnet  | DOGE   | D... (P2PKH)        | Enabled |
| Zcash     | zcash-mainnet     | ZEC    | t1... (Transparent) | Enabled |
| Flux      | flux-mainnet      | FLUX   | t1... (Transparent) | Enabled |
| Ravencoin | ravencoin-mainnet | RVN    | R... (P2PKH)        | Enabled |
| Ritocoin  | ritocoin-mainnet  | RITO   | R... (P2PKH)        | Enabled |
| BitcoinZ  | bitcoinz-mainnet  | BTCZ   | t1... (Transparent) | Enabled |
| NOSO      | noso-mainnet      | NOSO   | X... (P2PKH)        | Enabled |

Bitcoin and Litecoin load balances through Esplora APIs (Blockstream, Mempool.space, Litecoin Space). Other Bitcoin-like networks still show addresses. Explorer links use current hosts (CipherScan, Ravencoin Explorer, OKLink, Flux Blockbook, BitcoinZ). Retired sites such as dogechain.info, explorer.runonflux.io, and explorer.nosocoin.com were removed. Ritocoin and NOSO no longer have public address explorers after the lull.

### EVM Chains

| Network      | Network ID   | Symbol | Chain ID | Status  |
| ------------ | ------------ | ------ | -------- | ------- |
| Ethereum     | eth-mainnet  | ETH    | 1        | Enabled |
| OP Mainnet   | oeth-mainnet | ETH    | 10       | Enabled |
| BNB Chain    | bnb-mainnet  | BNB    | 56       | Enabled |
| Polygon      | pol-mainnet  | POL    | 137      | Enabled |
| Base         | base-mainnet | ETH    | 8453     | Enabled |
| Arbitrum One | arb1-mainnet | ETH    | 42161    | Enabled |

Advertised EVM networks load balances through current public RPCs (PublicNode, DRPC, and official chain endpoints). Retired leftover hosts such as 1rpc.io/sepolia were removed. Earlier leftover 1rpc.io/eth, moonriver.unitedbloc.com, Sepolia.org RPCs, zkevm.polygonscan.com, Cloudflare Ethereum, Ankr public RPC, and BlastAPI hops stay denylisted.

### SVM Chains (Solana-like)

| Network | Network ID      | Symbol | Address Format | Status  |
| ------- | --------------- | ------ | -------------- | ------- |
| Solana  | solana-mainnet  | SOL    | Base58         | Enabled |

Advertised Solana mainnet loads balances through current public RPCs (official Solana and PublicNode). Retired or key-gated hosts such as Ankr public RPC and Solana dRPC were removed.

Eclipse, Solana Devnet, and Solana Testnet are defined in config but disabled by default.

## Features

- Multi-chain wallet from a single mnemonic
- Cosmos staking with validator APR display
- REStake compatibility detection
- BeeZee staking pools (Offers)
- IBC transfers and IBC token support
- Multi-chain swaps via Skip.go
- Solana (SVM) addresses and balances
- EVM and Bitcoin-like (UTXO) account views

Supported networks were last reviewed in September 2026. The same curated list appears in Settings.

## Installation

### Web App

Visit [vidulum.app](https://vidulum.app) - no installation required.

### Browser Extension

#### From Source

```bash
# Clone the repository
git clone https://github.com/Corey-Code/vidulum-app.git
cd vidulum-app

# Install dependencies
npm install

# Build the extension
npm run build
```

#### Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Development

```bash
# Development build with watch (extension)
npm run dev

# Development server (web app)
npm run dev:web

# Production build (extension)
npm run build

# Production build (web app)
npm run build:web

# Run tests
npm test
```

## Documentation

Detailed documentation is available in the `docs/` folder:

- [Data Storage](docs/DATA_STORAGE.md) - How wallet data is stored and encrypted
- [Adding a Cosmos Chain](docs/ADDING_COSMOS_CHAIN.md) - Add new Cosmos SDK networks
- [Adding a UTXO Chain](docs/ADDING_UTXO_CHAIN.md) - Add new Bitcoin-like networks
- [Adding an EVM Chain](docs/ADDING_EVM_CHAIN.md) - Add new EVM networks
- [Adding an SVM Chain](docs/ADDING_SVM_CHAIN.md) - Add Solana or SVM-compatible networks
- [Adding a Network Type](docs/ADDING_NETWORK_TYPE.md) - Add a brand-new network family

## Project Structure

```
src/
  lib/
    networks/           - Network configurations and curated catalog
      cosmos.ts         - Manual Cosmos overrides
      bitcoin.ts        - UTXO chain configs
      evm.ts            - Manual EVM overrides
      solana.ts         - SVM chain configs
      supported-catalog.ts - User-facing supported-network list
    cosmos/             - Cosmos-specific code
    evm/                - EVM client
    solana/             - Solana RPC client
    storage/            - Encrypted storage
  popup/
    pages/              - Extension and web UI pages
    components/         - Reusable components
  web/                  - Web app entry (vidulum.app)
  background/           - Service worker
docs/                   - Documentation
```

## Security

- Mnemonic encrypted with AES-256-GCM
- PBKDF2 key derivation (100,000 iterations)
- Session-based unlock with auto-lock
- No plaintext secrets stored

See [Data Storage](docs/DATA_STORAGE.md) for details.

## Acknowledgements

This project is built with the following open-source libraries:

### Core Framework

- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Zustand](https://github.com/pmndrs/zustand) - State management

### UI Components

- [Chakra UI](https://chakra-ui.com/) - Component library
- [Framer Motion](https://www.framer.com/motion/) - Animation library
- [Emotion](https://emotion.sh/) - CSS-in-JS styling

### Blockchain & Cryptography

- [CosmJS](https://github.com/cosmos/cosmjs) - Cosmos SDK client libraries
- [Noble Hashes](https://github.com/paulmillr/noble-hashes) - Cryptographic hash functions
- [Noble Secp256k1](https://github.com/paulmillr/noble-secp256k1) - Elliptic curve cryptography
- [BIP32](https://github.com/bitcoinjs/bip32) - HD wallet key derivation
- [BIP39](https://github.com/bitcoinjs/bip39) - Mnemonic phrase generation

### Browser Extension

- [webextension-polyfill](https://github.com/nicknisi/webextension-polyfill) - Cross-browser extension API
- [CRXJS](https://crxjs.dev/vite-plugin) - Vite plugin for Chrome extensions

### Integrations

- [Skip.go](https://go.skip.build/) - Skip Go API is an end-to-end interoperability platform

## License

See LICENSE file.
