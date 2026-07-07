/// <reference path="../.astro/types.d.ts" />

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

declare namespace App {
  interface Locals {
    // We type the cloudflare runtime slice ourselves so the `Env` interface
    // declared at top-level resolves regardless of @astrojs/cloudflare's
    // generic type shape across versions.
    runtime: { env: Env };
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
