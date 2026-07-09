# FOLIO

> Editorial CMS for independent journalists. WYSIWYG markdown editor, Supabase
> auth + RLS, scheduled publishing via Cloudflare Workers cron.

Write once, publish identical. The editor preview and the reader view are
produced by **the same pipeline**, so what you see as you type is byte-for-byte
what your readers eventually see.

---

## ✨ Highlights

- **Side-by-side editor** with bidirectional scroll sync and instant client-side
  preview that converges to the server-rendered HTML after 600 ms of idle.
- **Supabase Auth + RLS**: every journalist only sees and mutates their own
  drafts.
- **Scheduled publishing** via a Cloudflare Worker cron trigger that runs every
  minute, flipping due posts to `published` automatically.
- **Editorial visual design** with a cream/ink/tomato palette, Source Serif 4
  for reading and Inter/JetBrains Mono for UI/code.
- **Atomic component design**, TypeScript everywhere, no code duplication
  (DRY), no premature abstraction (KISS).

---

## 💸 Is this free for a demo?

Yes — verified limits for early-2025:

| Service         | Free tier (what you get)| Sufficient for…                |
| --------------- | ----------------------- | ------------------------------ |
| **Supabase**    | 500 MB DB · 1 GB storage · 50 k MAU · 5 GB egress | Dozens of journalists × months |
| **Cloudflare**  | 100 k requests/day · 5 cron triggers · 128 MB memory · 1 GB KV | The full demo flow |

No credit card needed to start. Both services pause after long inactivity
(Supabase after ~1 week of no traffic — a single click wakes it up).

---

## 🚀 Quick start

You'll need: **Node ≥ 20.11**, **npm**, and free accounts on
[supabase.com](https://supabase.com) and
[cloudflare.com](https://cloudflare.com).

### 1 — Install

```bash
git clone <this-repo> folio && cd folio
npm install
```

### 2 — Create the Supabase project

1. Sign in to <https://supabase.com/dashboard> → **New project**.
2. Pick a region near you, set a strong database password, wait ~2 minutes
   for provisioning.
3. Open **SQL Editor → New query** → paste the contents of `db/schema.sql` →
   **Run**. This creates the `profiles`/`posts` tables, the indexes, the
   `post_status` enum, the auto-profile-on-signup trigger, and the RLS
   policies.
4. **Authentication → Providers → Email** — leave it on (default). You can
   optionally add Google/GitHub OAuth later; the editor automatically uses
   whatever is enabled.

### 3 — Wire environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```dotenv
PUBLIC_SITE_URL=http://localhost:4321
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi…   # Project Settings → API → anon public
SUPABASE_SERVICE_ROLE_KEY=eyJ…  # Project Settings → API → service_role
```

> ⚠️ The **service role** key bypasses RLS — it's only used by the cron
> Worker, never shipped to the browser. **Don't commit `.env`.**

Reveal these in the dashboard:
*Supabase Dashboard → Project → ⚙️ Settings → API*.

### 4 — Run the app locally

```bash
npm run dev
# → http://localhost:4321
```

You should see the landing page. Visit `/login`, **Create an account**, then
you're in `/admin`. Click **New article** → start typing on the left, watch
the live preview on the right. Hit **Publish** to go live at `/posts/<slug>`.

---

## 🧪 Tests

```bash
# Unit (Vitest): pipeline parity, slugify, helpers
npm test

# E2E (Playwright): make sure the dev server is reachable
npm run test:e2e:install   # one-time Chromium download
npm run test:e2e
```

The Vitest suite covers structural HTML, slug uniqueness, excerpt
helpers, the client-side shortcode renderer, and the server-side
shortcode + class-hook pipeline.

---

## ☁️ Deploy with Docker (self-hosted)

The app targets `@astrojs/node` standalone mode and ships with a production
Dockerfile + `docker-compose.yml`. Internally listens on **port 3000**;
network paths, nginx-proxy-manager wiring and volumes are all done by you
manually so the container stays a clean black box.

### A — Deploy the site (container)

On your server, once after cloning:

```bash
cp .env.example .env        # fill with the same values you use locally
docker compose up -d --build
docker network connect nginx_proxy_manager folio-web   # or your npm net name
docker logs -f folio-web     # confirm "Server listening on http://0.0.0.0:3000"
```

Subsequent deploys are a one-liner:

```bash
git pull && docker compose up -d --build
```

> 🔁 Whenever you change a `PUBLIC_*` var in `.env`, rebuild with
> `docker compose up -d --build` — Astro inlines them into the client bundle
> **at build time**, so a plain restart won't pick them up.

The image is tagged `folio:latest`, the container `folio-web`. Internal
port is **3000** (`expose:`, not `ports:` — nginx-proxy-manager reaches it
through the shared network you attached). No custom networks or volumes
are defined by the compose file.

### B — Deploy the cron Worker (still on Cloudflare)

The scheduled-publish cron keeps living on Cloudflare Workers because that
runtime ships native cron triggers — cheaper than wiring up a
self-hosted scheduler just for one minute-by-minute task.

```bash
# From the repo root:
cd worker
npm i wrangler
wrangler login
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler deploy
```

The schedule lives in `worker/wrangler.toml` (`* * * * *`) — a single
PATCH per due row, run once per minute. On the free tier you get up to 5
cron triggers per account; FOLIO only uses one.

> ⏳ Cron propagation can take ~15 min after the first deploy.

To trigger manually for testing:

```bash
curl https://folio-cron.<your-subdomain>.workers.dev/run
```

---

## 🏗 Architecture

```
                    Astro 5 (Node standalone, SSR)
┌──────────┐   ┌────────────────┐   ┌────────────────┐
│ /login   │   │ /admin/posts/* │   │ /posts/[slug]  │
│ AuthForm │   │ Editor island  │   │ unified MD→HTML│
│  (.tsx)  │   │  side-by-side  │   │                │
└──────────┘   └────────────────┘   └────────────────┘
       │              │                      ▲
       │              │  autosave / publish  │
       │              ▼                      │
       │        ┌──────────┐                │
       │        │ /api/*   │──shared──happy path─┐
       │        │+ /api/   │                │
       │        │  render  │                │
       │        └──────────┘                │
       │              │                      │
       │              ▼                      │
       │   ┌──────────────────────┐          │
       │   │  Supabase Postgres   │          │
       │   │  (auth + RLS + data) │──────────┘
       │   └──────────────────────┘
       │              ▲                      ▲
       │              │   service-role      │
       │              │   bypass RLS         │
       ▼              │                      │
   auth.js          ┌─┴────────────┐         │
   cookies          │ Cloudflare   │         │
                    │ Worker cron  │─────────┘
                    │ every minute │
                    └──────────────┘
```

### What is one source of truth?

Both the **editor preview** (debounced via `/api/render`) and the **/posts/[slug]**
page run the same `unified` pipeline (defined once in `src/lib/markdown/pipeline.ts`):
`remark-parse → remark-gfm → remark-shortcode-merge → remark-rehype →
rehype-raw → rehype-slugify → rehype-shortcodes → rehype-classes →
rehype-stringify`. Static MDX pages go through the matching subset via
`astro.config.mjs`. The Editor nudges the WYSIWYG into byte-parity
whenever the author pauses typing.

### Why React islands?

The editor is collaboration-shaped UI (textarea + autosave + scroll sync +
preview). Everything else is straight Astro so the public site is
**zero JS by default** — fastest possible read experience for journalists'
audiences.

### RLS rules — at a glance

| Table     | SELECT                           | INSERT       | UPDATE       | DELETE     |
| --------- | -------------------------------- | ------------ | ------------ | ---------- |
| profiles  | everyone                         | —            | owner only   | —          |
| posts     | published OR (author = me)       | author = me  | author = me  | author = me |

Service-role key bypasses everything, hence the cron Worker needing it.

---

## 🧬 File map

```
folio/
├── astro.config.mjs          # SSR + @astrojs/node standalone + MDX + React
├── Dockerfile                # multi-stage production build (folio:latest)
├── docker-compose.yml        # folio-web service, env_file: .env, expose 3000
├── .dockerignore             # mirrors .gitignore; keeps .env for PUBLIC_* bake-in
├── db/schema.sql             # tables, RLS, trigger — paste into Supabase
├── src/
│   ├── env.d.ts              # Astro.locals typing
│   ├── middleware.ts         # session bootstrap, /admin guard
│   ├── styles/global.css     # design tokens, components, mdx-* styles
│   ├── lib/
│   │   ├── types.ts          # Post/Profile/Payload shared types
│   │   ├── site.ts           # BRAND + SITE constants
│   │   ├── utils/slugify.ts  # diacritic-safe slug helpers
│   │   ├── posts/repo.ts     # supabase queries (RLS-friendly wrappers)
│   │   ├── supabase/server.ts # createServerClient bound to Astro cookies
│   │   └── markdown/         # ONE pipeline used by editor + public page
│   │       ├── pipeline.ts            ← server unified render
│   │       ├── render-client.ts       ← client preview (marked, mirrors shortcodes)
│   │       ├── remark-shortcode-merge.ts ← re-glues gfm autolink splits
│   │       ├── rehype-shortcodes.ts   ← ::callout/youtube/tweet → proper HTML
│   │       ├── rehype-slugify.ts      ← heading ids, diacritic-stripping
│   │       └── rehype-classes.ts      ← adds mdx-* class hooks
│   ├── components/
│   │   ├── templates/        # layouts (Base, Admin)
│   │   ├── organisms/        # Header, Footer, Editor, AuthForm
│   │   └── ui/               # atoms (kept minimal — most UI is CSS)
│   └── pages/
│       ├── index.astro                 # landing
│       ├── login.astro / logout.ts     # auth
│       ├── posts/index.astro           # public articles
│       ├── posts/[slug].astro          # published post (MDX-rendered)
│       ├── admin/                      # guarded editor section
│       └── api/                        # JSON endpoints (POST/PATCH/DELETE)
│       └── api/render.ts               # SSR markdown → HTML
├── worker/
│   ├── index.ts              # cron handler (publishes due posts)
│   └── wrangler.toml         # `* * * * *` schedule + secrets
├── tests/
│   ├── unit/                 # Vitest (pipeline, slugify)
│   └── e2e/                  # Playwright (public site)
└── README.md
```

---

## 🛟 Troubleshooting

| Symptom                                                              | Fix                                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Login page says "to enable auth, set PUBLIC_… env vars"              | Re-copy `.env.example → .env` and restart `npm run dev`. The browser client only sees vars prefixed with `PUBLIC_`.                |
| `Supabase: invalid API key` in browser console                       | Verify `PUBLIC_SUPABASE_ANON_KEY` matches *Project Settings → API → anon public*, not the service role.                            |
| Editor saves but post doesn't appear on `/posts`                     | Confirm `status='published'` was set. RLS hides drafts on the public route on purpose.                                             |
| Scheduled posts never go live                                       | Verify the Worker is deployed (`wrangler deployments list`). Wait ~15 min after first deploy for cron to propagate. Test `GET /run`. |
| 401 on `/api/render` from editor                                     | The endpoint requires an authenticated session — sign in first.                                                                   |
| Need a real domain                                                   | Set `PUBLIC_SITE_URL` to your deployed URL, otherwise `og:url` and canonical tags use the placeholder.                            |

---

## License

MIT — make it yours.
