# Privacy Policy

Last Updated: See Commit Time

## Overview

Vidulum App is a non-custodial, client-side browser extension. Your privacy is protected by design, not by policy.

## Data Collection

**We do not collect any data.**

- No personal information
- No wallet addresses
- No transaction history
- No usage analytics
- No telemetry
- No cookies
- No tracking

## Data Storage

All data is stored locally on your device:

- **Encrypted mnemonic** - Stored in your browser's local storage, encrypted with your password
- **Session data** - Temporarily stored in session storage while the wallet is unlocked
- **Preferences** - Network selections and display settings stored locally

No data is transmitted to any server controlled by Vidulum App.

## Third-Party Services

The wallet interacts with external services to function:

### Blockchain Networks

When you use the wallet, it communicates directly with blockchain nodes (RPC/REST endpoints) to:

- Query your balance
- Broadcast transactions
- Fetch validator information

These requests contain your wallet address by necessity. The wallet connects to public infrastructure or endpoints you configure.

### MoonPay (Optional)

If you use the Deposit or Withdraw features, you will be redirected to MoonPay's service. MoonPay has its own privacy policy and data collection practices. Use of MoonPay is entirely optional and requires your explicit action.

### Chain Registries

The wallet may fetch chain metadata from public registries (such as the Cosmos Chain Registry) to display network information.

## What We Cannot Access

- Your mnemonic phrase
- Your private keys
- Your password
- Your transaction history
- Your balance
- Your identity

All cryptographic operations occur locally in your browser. We have no servers that receive, process, or store your data.

## Open Source Verification

The source code is publicly available. You can verify these claims by reviewing the codebase yourself or having it reviewed by a trusted third party.

## Changes to This Policy

Any changes to this privacy policy will be reflected in the repository. The "Last Updated" date will be modified accordingly.

## Contact

For privacy concerns, open an issue in the project repository.
