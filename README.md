# Vidulum App

Vidulum multi-chain wallet application.

## Development

- Node 20 (see `.nvmrc`)
- `npm ci`
- `npm run dev` (extension) or `npm run dev:web` (web)

## Testing & CI

CI runs on `ubuntu-24.04` (pinned, since `ubuntu-latest` migrates to Ubuntu 26 beginning October 19, 2026 — see https://github.com/actions/runner-images/issues/14748).

```sh
npm run lint
npm run type-check
npm test
npm run build
```

## Chain registry

Regenerate `src/lib/assets/chainRegistry.ts` with `npm run sync:chain-registry`.

## Security

This repository never handles wallet seeds, private keys, signing secrets, or funds in CI or tooling. See PRIVACY_POLICY.md and TERMS_OF_USE.md.
