/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    // Per-request state attached by `src/middleware.ts`. Server-only env
    // values (SUPABASE_URL etc.) are read at runtime from `process.env`
    // via `env_file: .env` in docker-compose.yml, and from `import.meta.env`
    // when running under `astro dev`.
    supabase: import("@supabase/supabase-js").SupabaseClient | null;
    session: {
      user: {
        id: string;
        email?: string | null;
      } | null;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
