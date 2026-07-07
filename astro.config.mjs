// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import rehypeShortcodes from "./src/lib/markdown/rehype-shortcodes";
import rehypeClassNames from "./src/lib/markdown/rehype-classes";
import rehypeSlugify from "./src/lib/markdown/rehype-slugify";

// Public site URL — used in canonical/og tags. Change when you deploy.
const SITE = process.env.PUBLIC_SITE_URL ?? "https://folio.local";

export default defineConfig({
  site: SITE,
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
  integrations: [
    // Static MDX goes through the same rehype plugins as the server pipeline.
    // IMPORTANT: pass plugin factories WITHOUT invoking them — `rehypeClassNames()`
    // would hand back its inner transformer, which Astro then mis-registers,
    // leaving the plugin silently inert. Same `.use(plugin())` bug as
    // src/lib/markdown/pipeline.ts.
    mdx({
      // Order matters: slugify first so heading ids are settled, then
      // shortcodes (rewrites text nodes), then class hooks (mints mdx-*).
      // Do not reorder without checking that downstream rules still apply
      // before later plugins touch the same nodes.
      rehypePlugins: [rehypeSlugify, rehypeShortcodes, rehypeClassNames],
      smartypants: true,
      shikiOptions: {
        theme: "github-dark-dimmed",
        wrap: true,
      },
    }),
    react(),
  ],
  vite: {
    ssr: {
      // Bundle @supabase/* so Vite shims CJS `cookie` → ESM (otherwise runtime
      // crash on `import { parse } from "cookie"`). See worker/README if curious.
      noExternal: ["@supabase/supabase-js", "@supabase/ssr"],
    },
    optimizeDeps: {
      // Same shim needed client-side, otherwise astro-island hydration crashes.
      include: ["@supabase/supabase-js", "@supabase/ssr", "cookie"],
    },
  },
});
