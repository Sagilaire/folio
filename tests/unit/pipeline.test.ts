import { describe, it, expect } from "vitest";
import { renderMarkdown, makeExcerpt, readingTime } from "@/lib/markdown/pipeline";
import { renderMarkdownClient } from "@/lib/markdown/render-client";

const MD = `# Hello

A paragraph with **bold** and _italic_ and a [link](https://example.com).

- one
- two
- three

::callout{tip|::This is a tip.::}

> A short blockquote.
`;

describe("renderMarkdown (server pipeline)", () => {
  // Attribute order is not contracted (id may come before or after class);
  // each assertion checks class/id/content presence on the right tag.
  it("produces expected structural HTML", async () => {
    const html = await renderMarkdown(MD);
    expect(html).toMatch(/<h1\b[^>]*>Hello<\/h1>/);
    expect(html).toMatch(/<h1\b[^>]*class="mdx-h1"[^>]*>/);
    expect(html).toMatch(/<h1\b[^>]*id="hello"[^>]*>/);
    expect(html).toMatch(/<strong\b[^>]*class="mdx-strong"[^>]*>bold<\/strong>/);
    expect(html).toMatch(/<a\b[^>]*href="https:\/\/example\.com"[^>]*>/);
    expect(html).toMatch(/<a\b[^>]*class="mdx-a"[^>]*>/);
    expect(html).toMatch(/<ul\b[^>]*>/);
    expect(html).toMatch(/<ul\b[^>]*class="mdx-ul"[^>]*>/);
    // Callout body is parsed back through the same remark-rehype chain, so
    // the inner text lives inside a <p> (which the rehype-classes walker
    // tags with mdx-p). Assert tag presence, not byte-equality.
    expect(html).toMatch(
      /<aside\b[^>]*class="mdx-callout mdx-callout--tip"[^>]*>\s*<p\b[^>]*>[\s\S]*?This is a tip\.[\s\S]*?<\/p>\s*<\/aside>/,
    );
  });

  it("slugifies strictly and strips diacritics", async () => {
    const html = await renderMarkdown("## Cómo publicar");
    expect(html).toMatch(/<h2\b[^>]*>Cómo publicar<\/h2>/);
    expect(html).toMatch(/<h2\b[^>]*class="mdx-h2"[^>]*>/);
    expect(html).toMatch(/id="como-publicar"/);
  });

  it("renders a ::tweet{} shortcode", async () => {
    const html = await renderMarkdown("::tweet{https://x.com/news/status/123}");
    expect(html).toMatch(/<blockquote\b[^>]*class="mdx-tweet"[^>]*>/);
    expect(html).toMatch(
      /<a\b[^>]*href="https:\/\/x\.com\/news\/status\/123"[^>]*>/,
    );
  });

  it("escapes raw script tags", async () => {
    const html = await renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });
});

describe("renderMarkdownClient (mirrors shortcodes)", () => {
  it("renders shortcodes", () => {
    const html = renderMarkdownClient("Look ::youtube{dQw4w9WgXcQ} here.");
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
  it("renders callout", () => {
    expect(renderMarkdownClient("::callout{note|::Hi::}")).toMatch(
      /mdx-callout--note/,
    );
  });
});

describe("excerpt helpers", () => {
  it("makes an excerpt", () => {
    expect(makeExcerpt(MD, 50)).toMatch(/Hello/);
  });
  it("computes reading time", () => {
    expect(readingTime(MD)).toBeGreaterThan(0);
  });
});
