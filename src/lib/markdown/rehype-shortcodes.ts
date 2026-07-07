import type { Root, Element, ElementContent, Text } from "hast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";

// Sub-processor for the markdown body of `::callout{type|::...::}` shortcodes.
// Same parse→rehype chain as the main pipeline minus the post-rehype plugins.
//
// Known limitation: a callout body may NOT itself contain shortcodes
// (`::tweet{URL}`, `::youtube{ID}`, nested `::callout{}`) — they would
// survive the sub-processor as raw text. The main pipeline's
// `rehypeShortcodes` already ran before the body was spliced in. Add
// `rehypeShortcodes` here + a recursion guard (e.g. `skipCallouts` option)
// if you ever need shortcodes inside callout bodies.
const inlineProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: false });

async function parseMarkdownBody(md: string): Promise<ElementContent[]> {
  const tree = await inlineProcessor.run(inlineProcessor.parse(md));
  // `tree.children` is hast (no Raw nodes after remark-rehype) — assert it.
  return tree.children as ElementContent[];
}

const YT = /::youtube\{([\w-]{6,15})\}/g;
const TW = /::tweet\{((?:https?:\/\/)[^}]+)\}/g;
const CO = /::callout\{(note|warn|tip)\|::(.+?)::\}/g;

type Match = RegExpExecArray & { type: "yt" | "tw" | "co" };

function findMatches(value: string): Match[] {
  const matches: Match[] = [];
  YT.lastIndex = TW.lastIndex = CO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YT.exec(value))) matches.push(Object.assign(m, { type: "yt" as const }));
  while ((m = TW.exec(value))) matches.push(Object.assign(m, { type: "tw" as const }));
  while ((m = CO.exec(value))) matches.push(Object.assign(m, { type: "co" as const }));
  return matches.sort((a, b) => a.index - b.index);
}

async function buildHast(match: Match): Promise<Element | null> {
  if (match.type === "yt") {
    return {
      type: "element",
      tagName: "div",
      properties: { className: ["mdx-embed"] },
      children: [
        {
          type: "element",
          tagName: "iframe",
          properties: {
            src: `https://www.youtube-nocookie.com/embed/${match[1]}`,
            loading: "lazy",
            allowfullscreen: true,
            title: "YouTube video",
          },
          children: [],
        },
      ],
    };
  }
  if (match.type === "tw") {
    const href = match[1];
    return {
      type: "element",
      tagName: "blockquote",
      properties: { className: ["mdx-tweet"] },
      children: [
        {
          type: "element",
          tagName: "a",
          properties: { href, rel: "noopener noreferrer", target: "_blank" },
          children: [{ type: "text", value: href }],
        },
      ],
    };
  }
  if (match.type === "co") {
    const bodyChildren = await parseMarkdownBody(match[2]);
    return {
      type: "element",
      tagName: "aside",
      properties: {
        className: ["mdx-callout", `mdx-callout--${match[1]}`],
      },
      children: bodyChildren,
    };
  }
  return null;
}

async function transformTextNode(node: Text): Promise<ElementContent[]> {
  const matches = findMatches(node.value);
  if (matches.length === 0) return [node];

  const out: ElementContent[] = [];
  let last = 0;
  for (const m of matches) {
    if (m.index > last) {
      out.push({ type: "text", value: node.value.slice(last, m.index) } as Text);
    }
    const hast = await buildHast(m);
    if (hast) out.push(hast);
    last = m.index + m[0].length;
  }
  if (last < node.value.length) {
    out.push({ type: "text", value: node.value.slice(last) } as Text);
  }
  return out;
}

// Block-level elements that, when they end up inside a <p> wrapper, must be
// lifted out to be siblings — otherwise we ship invalid HTML (<aside> inside
// <p> is structurally wrong; browsers silently extract).
const BLOCK = new Set([
  "aside",
  "div",
  "blockquote",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "nav",
]);

// Container elements where shortcode text might appear in their `<p>` children.
// Inline elements (a, strong, em, code…) never contain raw markdown text.
const TEXT_CONTAINERS = new Set([
  "p",
  "div",
  "blockquote",
  "li",
  "header",
  "aside",
  "section",
  "article",
]);

async function processContainer(container: Element | Root): Promise<void> {
  const children = container.children;
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    if (child.type === "text") {
      const replacements = await transformTextNode(child as Text);
      if (replacements.length > 1 || replacements[0] !== child) {
        children.splice(i, 1, ...replacements);
        i += replacements.length;
      } else {
        i++;
      }
    } else if (child.type === "element") {
      const el = child as Element;
      // Only walk into elements where inline text might contain shortcodes.
      if (TEXT_CONTAINERS.has(el.tagName)) {
        await processContainer(el);
        // If a <p> has block-level shortcode children (aside/blockquote/div)
        // spliced in, lift them out as siblings so the HTML stays valid.
        if (
          el.tagName === "p" &&
          el.children.some(
            (c) => c.type === "element" && BLOCK.has(c.tagName),
          )
        ) {
          const spliced: ElementContent[] = [];
          let inline: ElementContent[] = [];
          for (const c of el.children) {
            if (c.type === "element" && BLOCK.has(c.tagName)) {
              if (inline.length > 0) {
                spliced.push({ ...el, children: inline } as Element);
                inline = [];
              }
              spliced.push(c);
            } else {
              inline.push(c);
            }
          }
          if (inline.length > 0) spliced.push({ ...el, children: inline } as Element);
          children.splice(i, 1, ...spliced);
          i += spliced.length;
        } else {
          i++;
        }
      } else {
        // Inline element (a, em, strong, code) — skip; never contains shortcode text.
        i++;
      }
    } else {
      i++;
    }
  }
}

export default function rehypeShortcodes() {
  return async (tree: Root) => {
    await processContainer(tree);
  };
}
