import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ locals, redirect }) => {
  const supabase = locals.supabase;
  if (supabase) {
    await supabase.auth.signOut();
  }
  // Supabase SSR also clears cookies via the response object.
  return redirect("/", 302);
};
