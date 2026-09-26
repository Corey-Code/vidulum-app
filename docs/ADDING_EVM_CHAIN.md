# Adding an EVM Chain

1. Add chain id, RPC URL, explorer, and native currency to `src/lib/assets/chainRegistry.ts`.
2. Run `npm run sync:evm-registry` to pull canonical metadata.
3. Verify contract address checksumming in tests.
