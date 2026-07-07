/** App-wide types — single source of truth. */

export type PostStatus = "draft" | "scheduled" | "published" | "archived";

export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: "journalist" | "admin";
  created_at: string;
}

export interface Post {
  id: string;
  author_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: PostStatus;
  scheduled_for: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type PostWithAuthor = Post & {
  author: Pick<Profile, "id" | "display_name" | "avatar_url">;
};

/** Payload accepted by /api/posts (create + update). */
export interface PostPayload {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  cover_image?: string | null;
  status?: PostStatus;
  scheduled_for?: string | null;
}
