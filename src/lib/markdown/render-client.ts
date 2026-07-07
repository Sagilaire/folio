/**
 * Client-side preview renderer. Mirrors the server pipeline's output for
 * markdown text (same GFM, same shortcodes), so as the user types the right
 * pane reflects the published view with zero latency. The /api/render
 * endpoint later swaps in the SSR HTML so subtle differences (server-only
 * rehype plugins, emoji substitution, etc.) converge to byte-parity.
 */
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false, pedantic: false });

function shortcodes(src: string): string {
  return src
    .replace(
      /::youtube\{([\w-]{6,15})\}/g,
      (_m, id) =>
        `<div class="mdx-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" loading="lazy" allowfullscreen></iframe></div>`,
    )
    .replace(/::tweet\{(https?:\/\/[^\}]+)\}/g, (_m, url) =>
      `<blockquote class="mdx-tweet"><a href="${url}" rel="noopener" target="_blank">${url}</a></blockquote>`,
    )
    .replace(
      /::callout\{(note|warn|tip)\|::(.+?)::\}/g,
      (_m, type, text) =>
        `<aside class="mdx-callout mdx-callout--${type}">${text}</aside>`,
    );
}

export function renderMarkdownClient(source: string): string {
  return marked.parse(shortcodes(source ?? ""), { async: false }) as string;
}
