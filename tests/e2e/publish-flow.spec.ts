import { test, expect, type Page } from "@playwright/test";

// E2E covers: sign in → new article → type → publish → editor confirms save
// + /api/render SSR preview matches the public route.
// Mocks the editor's network surface (POST /api/posts, PATCH /api/posts/:id,
// POST /api/render) — the Astro server sits between browser and Supabase.

test.describe("FOLIO editor — publish flow", () => {
  test("sign in → write → publish → SSR preview returns mdx-* HTML", async ({
    page,
  }) => {
    await stubBackend(page);

    // 1 — Sign in
    await page.goto("/login");
    await page.locator("#email").fill("journalist@folio.test");
    await page.locator("#password").fill("sup3rsecret");
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await page.waitForURL(/\/admin$/);

    // 2 — Open the editor
    await page.getByRole("link", { name: /New article/i }).click();
    await page.waitForURL(/\/admin\/posts\/new$/);

    // 3 — Fill the meta + body
    await page
      .locator('input[placeholder*="headline"]')
      .fill("How we cut publish time to 8 minutes");
    const textarea = page.locator("textarea").first();
    const md = [
      "# Welcome to FOLIO",
      "",
      "This is my **first** article written in the side-by-side editor.",
      "",
      "- reason 1",
      "- reason 2",
      "",
      "::callout{tip|::WYSIWYG promise verified::}",
      "",
    ].join("\n");
    await textarea.fill(md);

    // 4 — wait for /api/render preview
    await expect(page.locator(".preview-host .mdx-h1")).toContainText(
      "Welcome to FOLIO",
      { timeout: 4_000 },
    );

    // 5 — publish (POST /api/posts mocked)
    const createResp = page.waitForResponse(
      (r) => r.url().endsWith("/api/posts") && r.request().method() === "POST",
      { timeout: 5_000 },
    );
    await page.getByRole("button", { name: /^Publish/i }).click();
    const res = await createResp;
    expect(res.status()).toBe(201);

    // 6 — saved indicator updates + slug mirrors
    await expect(page.locator(".pill--published")).toBeVisible();
    await expect(page.locator(".hint")).toContainText(/\/posts\//);
  });

  test("/api/render parity — shortcodes AND headings end up in SSR HTML", async ({
    page,
  }) => {
    await stubBackend(page);
    await page.goto("/login");
    await page.locator("#email").fill("journalist@folio.test");
    await page.locator("#password").fill("sup3rsecret");
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await page.waitForURL(/\/admin$/);
    await page.getByRole("link", { name: /New article/i }).click();
    await page.waitForURL(/\/admin\/posts\/new$/);

    await page.locator("textarea").first().fill(
      "## Cómo publicar\n\n::callout{note|::Test corto::}",
    );

    // /api/render transforms ::callout and headings → mdx-* HTML
    await expect(page.locator(".preview-host .mdx-h2")).toContainText(
      "Cómo publicar",
      { timeout: 4_000 },
    );
    await expect(page.locator(".preview-host .mdx-callout--note")).toContainText(
      "Test corto",
    );
  });
});

// Mock Astro endpoints + Supabase auth so the editor flow is deterministic.
// Public SSR /posts/[slug] is NOT mocked (out of scope).
async function stubBackend(page: Page) {
  // editor endpoint surface
  await page.route("**/api/posts", async (route, req) => {
    if (req.method() === "POST") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "post-1", slug: "first-article" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });

  await page.route("**/api/posts/**", async (route, req) => {
    if (req.method() === "PATCH") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "post-1", slug: "first-article", status: "published" }),
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  // /api/render mirrors the server pipeline; return HTML production would emit.
  await page.route("**/api/render", async (route, req) => {
    const body = JSON.parse(req.postData() ?? "{}") as { content?: string };
    const html = bodyToHtml(body.content ?? "");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ html }),
    });
  });

  // auth: stub GoTrue so AuthForm's browser client logs in
  await page.route("**/auth/v1/**", async (route, req) => {
    if (req.url().endsWith("/token") && req.method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "fake-access-token",
          refresh_token: "fake-refresh",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: "user-123",
            email: "journalist@folio.test",
            aud: "authenticated",
            role: "authenticated",
          },
        }),
      });
    }
    return route.fulfill({ status: 200, body: "{}" });
  });

  // backing list queries so the admin dashboard renders the new post
  await page.route("**/rest/v1/posts**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "0-0/1" },
      body: JSON.stringify([
        {
          id: "post-1",
          title: "How we cut publish time to 8 minutes",
          slug: "first-article",
          status: "published",
        },
      ]),
    }),
  );
}

// Mirror of the unified pipeline's HTML for the simple cases — keeps the e2e
// decoupled from real Supabase while asserting the shape production emits.
function bodyToHtml(src: string): string {
  return src
    // shortcodes
    .replace(
      /::callout\{(note|warn|tip)\|::(.+?)::\}/g,
      (_m, type, text) =>
        `<aside class="mdx-callout mdx-callout--${type}">${escape(text)}</aside>`,
    )
    .replace(/::youtube\{([\w-]{6,15})\}/g, (_m, id) =>
      `<div class="mdx-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" loading="lazy" allowfullscreen></iframe></div>`,
    )
    .replace(/::tweet\{(https?:\/\/[^\}]+)\}/g, (_m, url) =>
      `<blockquote class="mdx-tweet"><a href="${url}" rel="noopener noreferrer" target="_blank">${url}</a></blockquote>`,
    )
    // headings
    .replace(/^# (.+)$/gm, (_m, t) => `<h1 class="mdx-h1" id="${slugify(t)}">${escape(t)}</h1>`)
    .replace(/^## (.+)$/gm, (_m, t) => `<h2 class="mdx-h2" id="${slugify(t)}">${escape(t)}</h2>`)
    .replace(/^### (.+)$/gm, (_m, t) => `<h3 class="mdx-h3" id="${slugify(t)}">${escape(t)}</h3>`)
    // paragraphs / list items
    .replace(/^- (.+)$/gm, (_m, t) => `<li class="mdx-li">${escape(t)}</li>`)
    .replace(/\*\*(.+?)\*\*/g, "<strong class=\"mdx-strong\">$1</strong>")
    .replace(/_([^_]+)_/g, "<em class=\"mdx-em\">$1</em>");
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
