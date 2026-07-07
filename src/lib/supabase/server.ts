import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";

// Per-request Supabase client. Astro 5's AstroCookies is write-only, so we
// read the request's cookies from the standard Request headers.
export function getSupabaseServer(
  url: string,
  anonKey: string,
  request: Request,
  cookies: AstroCookies,
): SupabaseClient {
  const cookieHeader = request.headers.get("cookie") ?? "";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader).map((c) => ({
          name: c.name,
          value: c.value ?? "",
        }));
      },
      setAll(
        toSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        for (const { name, value, options } of toSet) {
          cookies.set(name, value, {
            ...(options as Parameters<AstroCookies["set"]>[2]),
            path: (options?.path as string) ?? "/",
          });
        }
      },
    },
  });
}
