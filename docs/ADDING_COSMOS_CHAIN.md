# Adding a Cosmos Chain

1. Add the chain metadata to `src/lib/assets/chainRegistry.ts` (chain id, bech32 prefix, denom, decimals, RPC/LCD endpoints).
2. Run `npm run sync:chain-registry` to refresh generated assets.
3. Add tests covering the new chain's address derivation and balance queries.
4. Open a PR referencing this guide.
