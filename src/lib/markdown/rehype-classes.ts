import type { Node, Root, Element } from "hast";

const CLASS_MAP: Record<string, string[]> = {
  h1: ["mdx-h1"],
  h2: ["mdx-h2"],
  h3: ["mdx-h3"],
  h4: ["mdx-h4"],
  p: ["mdx-p"],
  ul: ["mdx-ul"],
  ol: ["mdx-ol"],
  li: ["mdx-li"],
  // blockquote is intentionally NOT here: the tweet shortcode wraps content
  // in a <blockquote class="mdx-tweet"> and we don't want the generic
  // `mdx-blockquote` class bleeding into shortcode output.
  code: ["mdx-code"],
  pre: ["mdx-pre"],
  hr: ["mdx-hr"],
  a: ["mdx-a"],
  img: ["mdx-img"],
  table: ["mdx-table"],
  strong: ["mdx-strong"],
  em: ["mdx-em"],
};

function walk(node: Node): void {
  if (node.type === "element") {
    const el = node as Element;
    const add = CLASS_MAP[el.tagName];

    if (add) {
      el.properties ??= {};
      const cur = el.properties.className;
      const existing: string[] = Array.isArray(cur)
        ? (cur as string[])
        : typeof cur === "string"
          ? cur.split(/\s+/)
          : [];
      el.properties.className = [...existing, ...add];
    }
    // Heading ids come from `rehype-slug` upstream — single source of truth
    // for slug shape, no re-slug here.
  }

  if ("children" in node && Array.isArray((node as { children?: unknown }).children)) {
    const children = (node as { children: Node[] }).children;
    for (const child of children) walk(child);
  }
}

export default function rehypeClassNames() {
  return (tree: Root) => walk(tree);
}
