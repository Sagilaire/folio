import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";

import rehypeShortcodes from "./rehype-shortcodes";
import rehypeClassNames from "./rehype-classes";
import rehypeSlugify from "./rehype-slugify";
import remarkShortcodeMerge from "./remark-shortcode-merge";

// `as any` on plugin factories sidesteps unified's strict overload checks; covered by tests.
//
// IMPORTANT: each plugin must be passed WITHOUT calling it. `.use(plugin())`
// would invoke the factory, returning the inner transformer (which unified
// then incorrectly tries to call as a plugin factory during setup, getting
// nothing back, so the real transformer never registers).
const processor = (unified() as any)
  .use(remarkParse)
  .use(remarkGfm)
  // gfm's autolink-literal splits `::tweet{URL}` across inline siblings; the
  // merge plugin re-glues them so rehype-shortcodes sees a single text node.
  .use(remarkShortcodeMerge)
  .use(remarkRehype, { allowDangerousHtml: false }) // escape raw HTML — safety over inline HTML
  .use(rehypeRaw) // no-op today (allowDangerousHtml=false upstream); kept so a future
                  // flip to `true` re-enables raw HTML pass-through without code surgery
  // Local slug plugin (replaces rehype-slug, which only exposes a `prefix`
  // option in v6 and hardcodes github-slugger, so it can't strip diacritics).
  .use(rehypeSlugify)
  .use(rehypeShortcodes)
  .use(rehypeClassNames)
  .use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
  const file = await processor.process(source ?? "");
  return String(file);
}

/** Trim markdown to a first-paragraph excerpt for cards/og tags. */
export function makeExcerpt(source: string, maxLen = 200): string {
  const text = (source ?? "")
    .replace(/::\w+\{[^}]*\}/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/[#>*_`~\-]/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/!\(.+?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

/** Estimate reading time in minutes using a ~200 wpm average. */
export function readingTime(source: string): number {
  const words = (source ?? "")
    .replace(/::\w+\{[^}]*\}/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
