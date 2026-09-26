# Adding a UTXO Chain

1. Add the chain's coin type, network magic, and explorer URL to `src/lib/assets/chainRegistry.ts`.
2. Confirm address encoding (legacy/bech32) in tests.
3. Update fee estimation defaults if the chain differs from Bitcoin.
