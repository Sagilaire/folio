# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# FOLIO — production Dockerfile
#
# Multi-stage build with the Node standalone adapter (`@astrojs/node`). The
# final image contains only the compiled `dist/` plus production node_modules,
# so it's small and starts instantly.
#
# The `.env` file at the build host is picked up by `COPY . .` so PUBLIC_*
# env vars get inlined into the client bundle by Astro. Server-only vars are
# injected at runtime by docker-compose's `env_file: .env`.
# ─────────────────────────────────────────────────────────────────────────────

# ── Base image ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
# libc6-compat is a near-universal safety net for alpine + Node native deps
# (sharp/rollup/etc.) even though our current deps are pure-JS.
RUN apk add --no-cache libc6-compat

# ── Full dependency tree (with devDeps — needed for `astro build`) ───────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Build ───────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
# Includes `src/`, `public/`, `astro.config.mjs`, `tsconfig.json`, etc.
# ALSO copies `.env` if present, which is how PUBLIC_* vars get baked into
# the client bundle. `.env.example` is included too but harmless.
COPY . .
RUN npm run build

# ── Production-only deps (smaller layer) ────────────────────────────────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ── Runtime image ───────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# The built-in `node` user in node:alpine is uid 1000 — drop privileges.
USER node

# Bring over only what the server needs at runtime. The `.env` file is NOT
# included — runtime vars come from the orchestrator (docker-compose env_file).
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build    --chown=node:node /app/dist          ./dist
COPY --from=build    --chown=node:node /app/package.json  ./package.json

EXPOSE 3000

# Lightweight in-cluster probe. nginx proxy manager will hit /healthz via the
# proxy host eventually; this avoids a separate curl install in alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
