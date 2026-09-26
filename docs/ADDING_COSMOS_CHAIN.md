# Adding a Cosmos Chain

1. Add the chain entry to the chain registry source.
2. Run `npm run sync:chain-registry` to regenerate `src/lib/assets/chainRegistry.ts`.
3. Verify bech32 prefix, denom, and RPC/REST endpoints.
