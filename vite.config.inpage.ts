import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite config for building the inpage provider script
 *
 * This script is injected into web pages and provides the window.keplr API.
 * It must be built as a self-contained IIFE with no external dependencies.
 */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/inpage.ts'),
      name: 'inpage',
      formats: ['iife'],
      fileName: () => 'inpage.js',
    },
    rollupOptions: {
      output: {
        entryFileNames: 'inpage.js',
        format: 'iife',
        // Don't mangle certain names that dApps might check
        manualChunks: undefined,
      },
    },
    // Inline all dependencies - the inpage script must be self-contained
    commonjsOptions: {
      include: [],
    },
    minify: 'esbuild',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
