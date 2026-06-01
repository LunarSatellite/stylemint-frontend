/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_SSO_AUTHORITY: string
  readonly VITE_SSO_CLIENT_ID: string
  readonly VITE_SSO_REDIRECT_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
