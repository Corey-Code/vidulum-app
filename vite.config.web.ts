import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

/**
 * Web build target (deploy to Cloudflare Pages).
 *
 * This is intentionally separate from the extension builds:
 * - Uses a normal site base path (`/`)
 * - Outputs to `dist-web/`
 * - Aliases `webextension-polyfill` to a browser-safe shim
 */
export default defineConfig({
  // In dev mode, Vite serves `${root}/index.html` at `/`.
  // Our web entry lives under src/web, so set root accordingly.
  root: resolve(__dirname, 'src/web'),
  plugins: [react(), nodePolyfills({ protocolImports: true })],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Some deps (e.g. @cosmjs/*) expect Node's crypto; use browser polyfill for web.
      crypto: 'crypto-browserify',
      'webextension-polyfill': resolve(__dirname, './src/platform/webextension-polyfill-web.ts'),
    },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    // Build-time constant to distinguish web app from extension
    __IS_WEB_BUILD__: JSON.stringify(true),
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  publicDir: resolve(__dirname, 'public-web'),
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        web: resolve(__dirname, 'src/web/index.html'),
      },
    },
  },
  base: '/',
});
