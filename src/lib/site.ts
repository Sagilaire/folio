/** App-wide constants — kept centralised to avoid drift. */

export const SITE = import.meta.env.PUBLIC_SITE_URL ?? "https://folio.local";

export const BRAND = {
  name: "FOLIO",
  tagline: "Write once, publish identical.",
  description:
    "Editorial CMS for independent journalists. WYSIWYG markdown editor, Supabase auth + RLS, scheduled publishing via Cloudflare Workers.",
} as const;
