# Maintenance

This repo went through a period of low activity. To bring it back up to date:

1. CI was updated to use current major versions of `actions/checkout` and `actions/setup-node` (v5), resolving the Node.js 20 deprecation warnings.
2. The Node version pinned in `.nvmrc` and `.node-version` was bumped to the active LTS line (22).
3. Run `npm ci` and `npm audit fix` locally before merging dependency updates.

## CI notes

- The `test` workflow runs on `ubuntu-latest`.
- Node version is read from `.nvmrc` via `node-version-file` so local and CI environments stay in sync.
