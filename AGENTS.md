# AGENTS.md

## Cursor Cloud specific instructions

Vidulum App is a non-custodial, multi-chain crypto wallet (React + Vite + TypeScript, Chakra UI,
Zustand). One codebase produces two products:

- **Browser extension** (Chrome/Firefox/Edge) — built to `dist/`, loaded unpacked.
- **Web app** — served from `src/web`, built to `dist-web/`.

Standard commands live in `package.json` and `README.md`/`CONTRIBUTING.md`. Notes below are only
the non-obvious, cloud-environment caveats.

### Running the web app (important caveat)
Do **not** use `npm run dev:web` in this VM. That script (`scripts/dev-web.sh`) sources `nvm`, which
aborts under `set -e` because the environment has `npm_config_prefix` set (nvm refuses to run, and
npm re-injects the var even if you `unset` it). The installed Node already satisfies the repo's
engine requirement (`>=22.12.0`), so just run Vite directly:

```bash
npx vite --config vite.config.web.ts
```

This serves the web app at http://localhost:5173/ . On first load the app shows an animated logo
loader for ~7 seconds before the onboarding ("Create Wallet") screen appears — this is expected, not
a hang.

### Building
- Extension: `npm run build` → outputs to `dist/` (load unpacked in `chrome://extensions`).
- Web app: `npm run build:web` → outputs to `dist-web/`.

### Tests
- `npm test` (Jest, jsdom). All suites pass.

### Lint
- `npm run lint` runs `eslint src --ext ts,tsx`. The eslint toolchain (eslint 8 + `@typescript-eslint`
  + react plugins) is declared in `devDependencies`; without it the script errors with
  `eslint: not found`. Lint currently exits non-zero due to **pre-existing** lint errors/warnings in
  the source — that is the repo's own lint state, not an environment problem.
