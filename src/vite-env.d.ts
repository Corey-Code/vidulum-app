/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VIDULUM_FEE_BPS?: string;
  readonly VIDULUM_FEE_BASE_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build-time constant to distinguish web app from extension.
 * Set via Vite's define config in vite.config.web.ts and vite.config.js.
 * - true in web build (vite.config.web.ts)
 * - false in extension build (vite.config.js)
 */
declare const __IS_WEB_BUILD__: boolean;
