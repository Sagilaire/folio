import type { APIRoute } from "astro";
import type { PostPayload } from "@/lib/types";
import { slugify, uniqueSlug } from "@/lib/utils/slugify";

// POST / GET — RLS does the auth check, this handler just projects columns.
export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase;
  const user = locals.session?.user;
  if (!supabase || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: PostPayload;
  try {
    body = (await request.json()) as PostPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) return new Response("Title required", { status: 422 });

  // Resolve a unique slug for this author.
  const { data: existing, error: e1 } = await supabase
    .from("posts")
    .select("slug");
  if (e1) return new Response(e1.message, { status: 500 });

  const taken = ((existing ?? []) as { slug: string }[]).map((p) => p.slug);
  const desiredBase = (body.slug && body.slug.trim()) || slugify(title);
  const slug = uniqueSlug(desiredBase || slugify(title), taken);

  const now = new Date().toISOString();
  const status = body.status ?? "draft";

  const insert = {
    author_id: user.id,
    title,
    slug,
    excerpt: body.excerpt ?? null,
    content: body.content ?? "",
    cover_image: body.cover_image ?? null,
    status,
    scheduled_for:
      status === "scheduled" ? body.scheduled_for ?? null : null,
    published_at:
      status === "published" ? (body.scheduled_for ?? now) : null,
  };

  const { data, error } = await supabase
    .from("posts")
    .insert(insert)
    .select("id, slug")
    .single();

  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const GET: APIRoute = async ({ locals }) => {
  const supabase = locals.supabase;
  const user = locals.session?.user;
  if (!supabase || !user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, status, scheduled_for, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify(data ?? []), {
    headers: { "Content-Type": "application/json" },
  });
};
