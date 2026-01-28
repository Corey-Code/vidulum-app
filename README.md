# Vidulum App

Free Open-Source browser extension wallet built by the people, for the people.

- [Purpose](PURPOSE.md) - Project mission and core principles
- [Privacy Policy](PRIVACY_POLICY.md) - No data collection, all storage is local
- [Terms of Use](TERMS_OF_USE.md) - Non-custodial wallet, user responsibilities

## Supported Networks

### Cosmos SDK Chains

| Network    | Chain ID    | Symbol | Status  |
| ---------- | ----------- | ------ | ------- |
| BeeZee     | beezee-1    | BZE    | Enabled |
| Osmosis    | osmosis-1   | OSMO   | Enabled |
| AtomOne    | atomone-1   | ATONE  | Enabled |
| Cosmos Hub | cosmoshub-4 | ATOM   | Enabled |

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

### EVM Chains

| Network   | Network ID       | Symbol | Chain ID | Status  |
| --------- | ---------------- | ------ | -------- | ------- |
| Ethereum  | ethereum-mainnet | ETH    | 1        | Enabled |
| Base      | base-mainnet     | ETH    | 8453     | Enabled |
| BNB Chain | bnb-mainnet      | BNB    | 56       | Enabled |

## Features

- Multi-chain wallet from a single mnemonic
- Cosmos staking with validator APR display
- REStake compatibility detection
- MoonPay integration for fiat on/off ramp
- BeeZee staking pools (Offers)
- IBC token support

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/corey-code/vidulum-app.git
cd vidulum-app

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

## Development

```bash
# Development build with watch
npm run dev

# Production build
npm run build

# Run tests
npm test
```

## Documentation

Detailed documentation is available in the `docs/` folder:

- [Data Storage](docs/DATA_STORAGE.md) - How wallet data is stored and encrypted
- [Adding a Cosmos Chain](docs/ADDING_COSMOS_CHAIN.md) - Add new Cosmos SDK networks
- [Adding a UTXO Chain](docs/ADDING_UTXO_CHAIN.md) - Add new Bitcoin-like networks
- [Adding an EVM Chain](docs/ADDING_EVM_CHAIN.md) - Add new EVM networks

## Project Structure

```
src/
  lib/
    networks/           - Network configurations
      cosmos.ts         - Cosmos chain configs
      bitcoin.ts        - UTXO chain configs
      evm.ts            - EVM chain configs
    crypto/             - Cryptographic operations
      keyring.ts        - Key management
      bitcoin.ts        - UTXO address derivation
      evm.ts            - EVM address derivation
    cosmos/             - Cosmos-specific code
      chainRegistry.ts  - Asset definitions
      client.ts         - Cosmos client
    storage/            - Encrypted storage
  popup/
    pages/              - Extension UI pages
    components/         - Reusable components
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

- [MoonPay](https://www.moonpay.com/) - Fiat on/off ramp integration

## License

See LICENSE file.
