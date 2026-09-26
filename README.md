# vidulum-app

The Vidulum wallet application. This repository contains the browser extension
and web app sources.

## Development

Requires Node.js 20 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

## Testing

```sh
npm test
npm run lint
```

## Security

This project never handles wallet seeds, private keys, signing secrets, or
funds in CI or build tooling. See [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines.

## License

See [LICENSE](LICENSE).
