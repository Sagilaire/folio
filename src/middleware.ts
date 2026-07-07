import type { MiddlewareHandler } from "astro";
import { getSupabaseServer } from "@/lib/supabase/server";

// Per-request middleware: build Supabase client, resolve session, guard /admin/*.
export const onRequest: MiddlewareHandler = async (context, next) => {
  const env = context.locals.runtime.env;
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_ANON_KEY;

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
