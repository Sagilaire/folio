import type { APIRoute } from "astro";
import { renderMarkdown } from "@/lib/markdown/pipeline";

// POST /api/render — editor preview pane calls this after 600ms idle to swap
// in the SSR rendering. Body: { content: string }. Auth required.
export const POST: APIRoute = async ({ request, locals }) => {
  // Auth required — bounds per-request SSR cost to authenticated journalists.
  if (!locals.session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { content?: string };
  try {
    body = (await request.json()) as { content?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const html = await renderMarkdown(body.content ?? "");
  return new Response(JSON.stringify({ html }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-cache",
    },
  });
};
