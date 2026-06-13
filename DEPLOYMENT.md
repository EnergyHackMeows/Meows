# Deploying to Cloudflare Pages

GridSight is a **TanStack Start SSR app**. Cloudflare Pages must deploy a Pages Function (`_worker.js`) plus static assets, not a plain static folder.

## Cloudflare Pages settings

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |

When `wrangler.toml` is present, `pages_build_output_dir = "./dist"` in that file is the source of truth.

## wrangler.toml (Pages-only keys)

Pages rejects Worker-style keys such as `main`, `rules`, and `[assets] binding = "ASSETS"`. Use only:

```toml
name = "meows"
compatibility_date = "2026-06-13"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"
```

## Build output

With `nitro.preset = "cloudflare-pages"`, the build emits:

- `dist/_worker.js/` — Pages Function (SSR handler)
- `dist/_routes.json` — which paths the worker handles
- `dist/assets/` — client JS/CSS
- `dist/_headers`, `dist/_redirects`

Do **not** override Nitro `output.serverDir` in `vite.config.ts`; that prevents `_worker.js` from being generated and causes 404s.

## Local preview

```bash
npm run build
npx wrangler pages dev dist
```

Open http://localhost:8788 — expect HTTP 200.

## Common failures

| Symptom | Cause |
|---------|--------|
| HTTP 404, build “succeeds” | Nitro skipped or `_worker.js` missing (wrong preset / output overrides) |
| `ASSETS` binding reserved | Declared `[assets]` in wrangler.toml on Pages |
| `main` + `pages_build_output_dir` | Mixed Workers + Pages config in wrangler.toml |
