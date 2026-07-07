import type { Root, Element, Node } from "hast";
import { slugify } from "../utils/slugify";

// Collect plain text from an element's descendants — used to derive the
// heading-id slug. We avoid hast-util-to-string to keep the plugin
// dependency-free for testing.
function collectText(el: Element): string {
  let out = "";
  for (const c of el.children) {
    if (c.type === "text") {
      out += c.value;
    } else if (c.type === "element") {
      out += collectText(c);
    }
  }
  return out;
}

function walk(node: Node): void {
  if (node.type === "element") {
    const el = node as Element;
    if (/^h[1-6]$/.test(el.tagName)) {
      el.properties ??= {};
      // `slugify` strips diacritics ("Cómo publicar" → "como-publicar"),
      // collapses whitespace, and trims leading/trailing hyphens.
      el.properties.id = slugify(collectText(el));
    }
  }
  if (
    "children" in node &&
    Array.isArray((node as { children?: unknown }).children)
  ) {
    const children = (node as { children: Node[] }).children;
    for (const child of children) walk(child);
  }
}

/**
 * Local replacement for `rehype-slug` because rehype-slug v6 does not accept
 * a `slugify` option (the installed 6.0.0 hardcodes github-slugger and only
 * exposes a `prefix` knob). This plugin walks every h1–h6 and assigns
 * `properties.id` using our util `slugify`, which strips diacritics so
 * "Cómo publicar" produces `id="como-publicar"`.
 */
export default function rehypeSlugify() {
  return (tree: Root) => walk(tree);
}
