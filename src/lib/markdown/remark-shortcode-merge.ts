import type { Root, Paragraph, Text, PhrasingContent } from "mdast";
import { visit } from "unist-util-visit";

/**
 * remark-gfm's autolink-literal extension rewrites `::tweet{https://x.com/foo}`
 * into `[text "::tweet{"][link url="https://x.com/foo%7D"][text ""]` — the URL
 * absorbs the trailing `}`. This plugin scans paragraphs left-to-right and
 * glues those splits back together so the downstream rehype-shortcodes walker
 * sees the original `::tweet{...}` shape as a single text node.
 */
const SHORTCODE_RE =
  /::(?:youtube\{([\w-]{6,15})\}|tweet\{((?:https?:\/\/)[^}]+)\}|callout\{(note|warn|tip)\|::([\s\S]+?)::\})/;

function mergeShortcodes(p: Paragraph): void {
  const ch = p.children as PhrasingContent[];
  let i = 0;
  while (i < ch.length) {
    const c = ch[i];
    if (c.type !== "text" || !/^::(?:youtube|tweet|callout)\{/.test(c.value)) {
      i++;
      continue;
    }

    // Accumulate following text + decoded-link-url siblings until the
    // shortcode regex matches at position 0 (full pattern captured).
    let synth = c.value;
    let lastIdx = i;
    let matched = false;

    while (lastIdx < ch.length - 1) {
      const next = ch[lastIdx + 1];
      let nextVal = "";
      if (next.type === "text") {
        nextVal = next.value;
      } else if (next.type === "link" && typeof next.url === "string") {
        try {
          nextVal = decodeURIComponent(next.url);
        } catch {
          // Malformed escape sequence (rare) — fall back to raw URL.
          nextVal = next.url;
        }
      } else {
        break;
      }
      synth += nextVal;
      lastIdx++;

      const m = synth.match(SHORTCODE_RE);
      if (m && m.index === 0) {
        matched = true;
        break;
      }
      // If we have more `}` than `{`, the shortcode can't ever close — bail.
      const opens = (synth.match(/\{/g) || []).length;
      const closes = (synth.match(/\}/g) || []).length;
      if (closes > opens) break;
    }

    const m = synth.match(SHORTCODE_RE);
    if (matched && m && m.index === 0) {
      ch.splice(i, lastIdx - i + 1, { type: "text", value: m[0] } as Text);
      i++;
    } else {
      i++;
    }
  }
}

export default function remarkShortcodeMerge() {
  return (tree: Root) => {
    visit(tree, "paragraph", mergeShortcodes);
  };
}
