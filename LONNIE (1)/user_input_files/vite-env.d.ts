/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional fallback for initial setup - URL is stored in localStorage for flexibility
  readonly VITE_CLOUDFLARE_WORKER_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
