/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POCKETBASE_URL: string
  readonly VITE_FORCE_MOCK?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
