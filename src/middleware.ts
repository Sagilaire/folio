import type { MiddlewareHandler } from "astro";
import { getSupabaseServer } from "@/lib/supabase/server";

// Per-request middleware: build Supabase client, resolve session, guard /admin/*.
export const onRequest: MiddlewareHandler = async (context, next) => {
  // process.env is populated by `env_file: .env` in docker-compose.yml.
  // import.meta.env falls back to the same values during `astro build`.
  const supabaseUrl =
    process.env.SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ?? import.meta.env.SUPABASE_ANON_KEY;

  context.locals.supabase = null;
  context.locals.session = null;

  if (supabaseUrl && supabaseKey) {
    const supabase = getSupabaseServer(
      supabaseUrl,
      supabaseKey,
      context.request,
      context.cookies,
    );
    context.locals.supabase = supabase;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    context.locals.session = { user: user ?? null };
  }

  const { pathname } = context.url;

  if (pathname.startsWith("/admin") && !context.locals.session?.user) {
    return context.redirect(
      `/login?return=${encodeURIComponent(pathname)}`,
      302,
    );
  }

  return next();
};
