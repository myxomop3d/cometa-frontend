# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Build context is the REPO ROOT, not deploy/. Build with:
#   docker build -f deploy/Dockerfile -t cometa-frontend:latest .
# ─────────────────────────────────────────────────────────────

# ── stage 1: build the static bundle ────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install deps against the lockfile first for better layer caching.
# .npmrc carries legacy-peer-deps=true (Vite 8 peer-dep compat).
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Build. `npm run build` runs `tsc -b && vite build`, so it type-checks.
COPY . .
RUN npm run build          # → /app/dist (static HTML/JS/CSS)

# ── stage 2: serve with non-root nginx ──────────────────────
# nginx-unprivileged already runs as uid 101 and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# Replace the default server block with our SPA config.
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the built assets — no Node, no source, no node_modules.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# Base image's CMD already starts nginx in the foreground.
