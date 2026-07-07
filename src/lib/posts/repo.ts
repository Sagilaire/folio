import type { SupabaseClient } from "@supabase/supabase-js";
import type { Post, PostWithAuthor } from "@/lib/types";

// Posts repository — thin Supabase wrappers. RLS handles permissions.

const POST_SELECT = `
  id, author_id, title, slug, excerpt, content, cover_image, status,
  scheduled_for, published_at, created_at, updated_at,
  author:profiles!posts_author_id_fkey ( id, display_name, avatar_url )
`;

export async function listPublished(
  supabase: SupabaseClient,
  limit = 20,
): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PostWithAuthor[];
}

export async function getPublishedBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as PostWithAuthor | null;
}

export async function listOwn(
  supabase: SupabaseClient,
  limit = 50,
): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, slug, status, scheduled_for, published_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function getOwnById(
  supabase: SupabaseClient,
  id: string,
): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, author_id, title, slug, excerpt, content, cover_image, status, scheduled_for, published_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Post | null;
}

// Slugs already in use by this author — used to ensure uniqueness.
export async function listOwnSlugs(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("slug");
  if (error) throw error;
  return ((data ?? []) as { slug: string }[]).map((p) => p.slug);
}
