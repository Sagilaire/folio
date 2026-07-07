-- ============================================================================
-- FOLIO — Supabase schema, RLS policies, and bootstrap SQL.
--
-- How to apply
--   1. Create a new Supabase project (free tier is fine).
--   2. Open the SQL Editor (Project → SQL → New query).
--   3. Paste the contents of this file and run.
--
-- After applying, your DB has:
--   • profiles table (extends auth.users 1-1)
--   • posts table with draft / scheduled / published lifecycle
--   • RLS so journalists only see + mutate their own posts
--   • A trigger that auto-creates a `profiles` row on signup
--   • Indexes optimised for the cron-worker scan
-- ============================================================================

create extension if not exists "uuid-ossp";

-- profiles -----------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio          text,
  avatar_url   text,
  role         text not null default 'journalist'
                check (role in ('journalist','admin')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- posts --------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'post_status') then
    create type post_status as enum ('draft', 'scheduled', 'published', 'archived');
  end if;
end$$;

create table if not exists public.posts (
  id            uuid primary key default uuid_generate_v4(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  title         text not null default '',
  slug          text not null,
  excerpt       text,
  content       text not null default '',
  cover_image   text,
  status        post_status not null default 'draft',
  scheduled_for timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(author_id, slug)
);

create index if not exists posts_scheduled_idx
  on public.posts (scheduled_for)
  where status = 'scheduled';

create index if not exists posts_published_idx
  on public.posts (published_at desc)
  where status = 'published';

create index if not exists posts_author_idx
  on public.posts (author_id, updated_at desc);

-- updated_at triggers ------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch
  before update on public.posts
  for each row execute procedure public.touch_updated_at();

-- auto-create profile on auth.users insert ---------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'editor@folio'), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS ----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.posts    enable row level security;

-- profiles: everyone can read public-facing fields; only owner can update
drop policy if exists "profiles_read_all"   on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_read_all"
  on public.profiles for select using (true);
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- posts: published are public, drafts only author can see
drop policy if exists "posts_select_published_or_own" on public.posts;
drop policy if exists "posts_insert_own"               on public.posts;
drop policy if exists "posts_update_own"               on public.posts;
drop policy if exists "posts_delete_own"               on public.posts;
create policy "posts_select_published_or_own"
  on public.posts for select using (
    status = 'published' or auth.uid() = author_id
  );
create policy "posts_insert_own"
  on public.posts for insert with check (auth.uid() = author_id);
create policy "posts_update_own"
  on public.posts for update using (auth.uid() = author_id);
create policy "posts_delete_own"
  on public.posts for delete using (auth.uid() = author_id);

-- Service-role note ---------------------------------------------------------
-- The Cloudflare cron Worker uses the SUPABASE_SERVICE_ROLE_KEY. That role
-- bypasses RLS — keep the key secret and only set it in the Worker env.
