# Deploying to Cloudflare Pages

GridSight is a **TanStack Start SSR app**, not a static Vite SPA. Cloudflare Pages must deploy a Worker plus static assets, not plain files from `dist/` alone.

## Why the site 404'd

With only `npm run build` and output directory `dist`, the Lovable Vite config skips the Nitro deploy plugin outside its sandbox. That produces:

- `dist/client/assets/*` — JS/CSS bundles only
- `dist/server/*` — SSR modules only
- **No** `index.html` and **no** Cloudflare Worker entry

Pages uploaded those files as a static site with no route handler, so `/` returned HTTP 404.

## Fix in this repo

1. **`vite.config.ts`** — `nitro` is enabled with the `cloudflare-module` preset so the build emits a Worker + assets layout.
2. **`wrangler.toml`** — tells Cloudflare Pages to deploy the Worker at `dist/server/index.mjs` and static assets from `dist/client` via `pages_build_output_dir`. Do **not** set `binding = "ASSETS"` — that name is reserved on Pages and is injected automatically.

## Cloudflare Pages settings

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist/client` (optional once `wrangler.toml` is present; it sets `pages_build_output_dir`) |
| Root directory | `/` |

Cloudflare should log **Wrangler configuration file found** during the build. If it still says "No Wrangler configuration file found", the deploy is falling back to static-only mode.

## Local preview

```bash
npm run build
npx wrangler dev
```

Open http://localhost:8787 — you should see the GridSight dashboard (HTTP 200).

## Node compatibility

The Worker requires `nodejs_compat`, which is set in `wrangler.toml` via `compatibility_flags`.
