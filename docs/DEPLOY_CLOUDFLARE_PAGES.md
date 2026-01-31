# Deploy website build to Cloudflare Pages (vidulum.app)

This repo builds **two** targets:

- **Extension** (default `npm run build`) → `dist/`
- **Website** (`npm run build:web`) → `dist-web/`

## Cloudflare Pages settings

Create a new Cloudflare Pages project pointing at this repo.

- **Build command**: `npm ci && npm run build:web`
- **Build output directory**: `dist-web`
- **Root directory**: _(leave blank)_

### Node.js version

This repo targets Node.js 22.12.0. In Cloudflare Pages, set:

- `NODE_VERSION` = `22.12.0`

This repo also includes `.nvmrc` / `.node-version` and `package.json` `engines` to keep local dev and CI aligned.

### SPA routing

This repo includes `public-web/_redirects` so deep links work on Pages.

## Attach the custom domain (vidulum.app)

In Cloudflare Pages:

- Go to **Custom domains**
- Add `vidulum.app` (and optionally `www.vidulum.app`)

Cloudflare will guide you through DNS.

## Local verification

- Build: `npm run build:web`
- Preview: `npx vite preview --outDir dist-web --config vite.config.web.ts`

(Or run dev server: `npm run dev:web`)
