import type { APIRoute } from "astro";

// GET / PATCH / DELETE — all owner-only via RLS.
// Status rules:
//   'published' + no published_at → published_at = now()
//   'scheduled'  + no scheduled_for → 422
//   otherwise → leave timestamps untouched
export const GET: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase;
  const user = locals.session?.user;
  if (!supabase || !user) return new Response("Unauthorized", { status: 401 });
  const { id } = params;
  if (!id) return new Response("Bad request", { status: 400 });

  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, slug, excerpt, content, cover_image, status, scheduled_for, published_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase;
  const user = locals.session?.user;
  if (!supabase || !user) return new Response("Unauthorized", { status: 401 });

  const { id } = params;
  if (!id) return new Response("Bad request", { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Whitelist fields.
  const allowed = [
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image",
    "status",
    "scheduled_for",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = body[k];
  }

  // Status coherence
  if (patch.status === "scheduled" && !patch.scheduled_for) {
    return new Response("scheduled_for required when status=scheduled", {
      status: 422,
    });
  }
  if (patch.status === "published") {
    const existing = await supabase
      .from("posts")
      .select("published_at")
      .eq("id", id)
      .maybeSingle();
    if (!existing.data) return new Response("Not found", { status: 404 });
    if (!existing.data.published_at) {
      patch.published_at = new Date().toISOString();
    }
    patch.scheduled_for = null;
  }
  if (patch.status === "draft") {
    patch.scheduled_for = null;
  }

  const { data, error } = await supabase
    .from("posts")
    .update(patch)
    .eq("id", id)
    .select("id, slug, status")
    .single();
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase;
  const user = locals.session?.user;
  if (!supabase || !user) return new Response("Unauthorized", { status: 401 });
  const { id } = params;
  if (!id) return new Response("Bad request", { status: 400 });

  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(null, { status: 204 });
};
