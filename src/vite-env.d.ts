/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOONPAY_API_KEY?: string;
  readonly VITE_MOONPAY_ENV?: 'sandbox' | 'production';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
