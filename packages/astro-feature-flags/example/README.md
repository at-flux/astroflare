# Example: static site + GitHub Pages

Two flags (`dev`, `hotFeature2`): **`data-ff`**, route pill (`data-ff-route` + `routeFeatureTokenForPath`), toolbar. See parent [`docs/assets/`](../docs/assets/).

1. Set `base` / `site` in `astro.config.mjs` for GitHub Pages.
2. `pnpm install` → `pnpm dev`.
3. `pnpm build` → deploy `dist/`.

**Config:** `ff.json`; `ff.prod.json` (prod); `ff.<FF_ENV>.json` when `FF_ENV` is set (`ffEnv` in config).

**Layout:** `Layout.astro` — `featureFlagStyles`, `affDevBootstrap`, `data-ff-route`.
