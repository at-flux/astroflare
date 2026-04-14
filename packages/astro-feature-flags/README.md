# @at-flux/astro-feature-flags

[![npm version](https://img.shields.io/npm/v/@at-flux/astro-feature-flags.svg)](https://www.npmjs.com/package/@at-flux/astro-feature-flags)
[![CI](https://github.com/at-flux/astroflare/actions/workflows/ci.yml/badge.svg)](https://github.com/at-flux/astroflare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<p align="center">
  <img src="./docs/assets/toolbar-feature-flags.png" alt="Feature Flags Toolbar" width="50%" style="max-width:500px;" />
  <img src="./docs/assets/element-gating.png" alt="Feature Flags element gating" width="40%" style="max-width:400px;" />
  <br/>
  <img src="./docs/assets/page-gating.png" alt="Feature Flags route gating" width="60%" style="max-width:600px;" />
</p>

Feature flags for Astro with a declarative config:

- per-flag declaration (`colour`/`color` for the dev toolbar, optional `routes` for matching pages)
- **Two environments:** **Astro dev** (`astro dev`) vs **non-dev builds** (production deploys, `astro build` in CI, staging, …). Locally, the integration uses a built-in **dev** environment layer (injected for you; all flags on at resolve time). For shipped output you declare layers such as **`prod`** / **`staging`** with `when` + `flags`. Exactly one `when: true` for the selected environment unless you override with **`forceEnvironment`** / **`AFF_ENVIRONMENT`**.
- **Route gating (non-dev):** If a pathname matches a flag’s `routes` and that flag is **off** for the active layer, **static** `dist/` output under that prefix is **removed after build** (and you should filter those URLs from sitemaps—see how-to). Server/hybrid apps still need their own runtime routing if URLs can be requested without a matching static file. If the flag is **on**, routes emit like any other page.
- **Route overlap:** `shouldIncludePath`, `shouldIncludeRoute`, and `shouldIncludePathForEnvironment` use the **first** matching `routes` entry from `Object.entries` order, not longest-prefix. `matchedFeatureRoutePrefix` / `routeFeatureTokensForPath` use **longest** match — avoid overlapping patterns unless order is intentional.
- element gating via namespaced attributes (`data-ff` or `data-ff-<token>` by default)
- production static HTML: gated `data-ff` nodes culled, dev-only CSS not shipped (`featureFlagStyles` is empty); dev route attributes (`data-ff-route*`) are stripped from `<html>`
- route badge + production route pruning
- dev toolbar for enabled/outline/badge/colour preview (when a URL would be pruned for a configured layer, the overlay names **environment keys**, not `NODE_ENV` text)

## Terminology (short)

| Term | Meaning |
| ---- | ------- |
| **Astro dev** | Local `astro dev` — the built-in dev layer is active; all flags on at resolve time; dev toolbar only affects the browser. |
| **Non-dev build** | `astro build` / preview / deploy with a shipped layer (`prod`, `staging`, …): `environments.<key>.flags` drives SSR, HTML culling, and route pruning. |
| **`isAstroDev`** (virtual module) | `import.meta.env.DEV` — Vite’s compile-time flag for components. Layer selection still comes from `environments` / `forceEnvironment`; use `isAstroDev` when you need Astro’s literal dev detection. |

You cannot add an environment key named **`dev`** — that name is reserved and merged automatically (including its `when`; you do not set it in config).

## Quickstart

1. Configure in `astro.config.mjs`:

   ```js
   import astroFeatureFlags from "@at-flux/astro-feature-flags";

   export default defineConfig({
     integrations: [
       astroFeatureFlags({
         // optional: jsonConfigPath: "./ff.json",
         // optional: configRoot: fileURLToPath(new URL(".", import.meta.url)),
         flags: {
           wip: {
             colour: "rgb(220 38 38)",
             routes: ["/blog/*"],
           },
           hotFeature1: {
             colour: "rgb(37 99 235)",
             routes: ["/hot-feature-1/*"],
           },
           hotFeature2: {
             colour: "rgb(34 197 94)",
             outline: false,
             badge: true,
             routes: ["/hot/*", "/hot-dev/*"],
           },
         },
         environments: {
           prod: {
             when: process.env.NODE_ENV === "production",
             flags: {
               wip: false,
               hotFeature1: true,
               hotFeature2: false,
             },
           },
         },
       }),
     ],
   });
   ```

2. Optional JSON: **`jsonConfigPath`** on the integration root (merged after inline config). Optional **`jsonConfigPath`** on each **non-`dev`** environment merges when that layer is active (after the root file). Paths resolve relative to `configRoot` (`process.cwd()` by default).

   ```json
   {
     "environments": {
       "prod": {
         "flags": { "hotFeature1": false }
       }
     }
   }
   ```

3. Gate elements in markup:
   - `data-ff={FeatureToken.HotFeature2}`
   - `data-ff={[FeatureToken.Wip, FeatureToken.HotFeature2].join(' ')}`
   - `data-ff="wip hot-feature-2"` **(no import!)**
   - `data-ff-wip` **(no import!)**
   - `data-ff-hot-feature-2` **(no import!)**

> [!NOTE]
> Flags are combinatory. If an element has `data-ff="wip hot-feature-2"`, both flags must be enabled for SSR outside the reserved `dev` layer.
>
> In the dev toolbar preview, combined flags are also combinatory for **Enabled**: if any token in the combo is set to Off, the whole combined element is hidden.
>
> In **Astro dev**, all declared flags are on at resolve time; the dev toolbar only changes client preview. In **non-dev** builds, nodes that fail the check are **removed from the HTML**. Route-mapped prefixes with a flag **off** are pruned from static `dist/` after build. Prefer **`shouldRenderFeature`** when you need compile-time omission with no trace in `dist/`.

## Common Use Cases

### 1) Per-element token (imported)

```tsx
---
import { FeatureToken } from 'virtual:astro-feature-flags';
---

<section data-ff={FeatureToken.Wip}>WIP section</section>
<aside data-ff={FeatureToken.HotFeature2}>Hot section</aside>
```

You can also use flag names in `data-ff`:

```tsx
---
import { FeatureFlag } from 'virtual:astro-feature-flags';
---

<aside data-ff={FeatureFlag.HotFeature2}>Hot section</aside>
```

### 2) Shorthand attribute (no import)

```tsx
<section data-ff-wip>WIP section</section>
<aside data-ff-hot-feature-2>Hot section</aside>
```

`data-ff-wip` is equivalent to `data-ff={FeatureToken.Wip}` or `data-ff="wip"`.

If `tokenNamespace` is `aff`, use `data-aff` / `data-aff-<token>` instead.

### 2b) Combined flags (AND behavior)

Both flags must be enabled:

```tsx
<div data-ff-wip data-ff-hot-feature-2>
  ...
</div>
```

Or using `data-ff` with values:

```tsx
---
import { FeatureFlag } from 'virtual:astro-feature-flags';
---

<div data-ff={[FeatureFlag.Wip, FeatureFlag.HotFeature2].join(' ')}>...</div>
// OR
<div data-ff="wip hot-feature-2">...</div>
```

`data-ff` expects a space-separated list of feature flags.

### 3) Dev toolbar head injection (automatic)

On **`astro dev`**, when the built-in dev layer is active, the integration uses Astro’s **`injectScript('head-inline', …)`** to append dev-only CSS, set **`data-ff-route`** on `<html>` from the current URL (including after **`astro:page-load`** / **`astro:after-swap`**), and run the toolbar bootstrap script. You do **not** need to wire `affDevBootstrap`, `featureFlagStyles`, or `data-ff-route` in a root layout unless you intentionally want a second copy.

The virtual module still exports **`affDevBootstrap`**, **`featureFlagStyles`**, and **`routeFeatureTokensForPath`** for advanced layouts.

### 4) Logic usage (`FeatureFlag`)

Use this when you need explicit conditional logic in frontmatter (most UI cases can stay markup-only with `data-ff-*`):

```ts
import { FeatureFlag, shouldRenderFeature } from "virtual:astro-feature-flags";
```

`shouldRenderFeature()` and `isFeatureEnabled()` follow config/env values.\
The dev toolbar changes client-side preview state only.

## Configuration Schema

### Top-level options

| Option             | Type                                | Default         | Notes                                                                 |
| ------------------ | ----------------------------------- | --------------- | --------------------------------------------------------------------- |
| `configRoot`       | `string`                            | `process.cwd()` | Resolves relative `jsonConfigPath` values (root + per-environment).   |
| `jsonConfigPath`   | `string`                            | unset           | Optional **root** JSON file merged after inline config (see merge order for per-environment files). |
| `forceEnvironment` | `string`                          | unset           | Pin the active layer (skips `when` / `AFF_ENVIRONMENT` validation).   |
| `mode`             | `string`                            | `NODE_ENV`      | Optional advanced override for runtime resolution (mainly tests/tooling). Most apps should omit this and rely on `NODE_ENV` + `environments.when`. |
| `env`              | `Record<string, string \| undefined>` | `process.env` | `AFF_FEATURE_*` / `ASTRO_FEATURE_FLAGS` (not applied in `dev` layer). |
| `tokenNamespace`   | `string`                            | `'ff'`          | CSS var namespace (`--ff-c-*`).                                       |
| `flags`            | `Record<string, FlagConfig>`        | `{}`            | Flag declarations.                                                    |
| `environments`     | `Record<string, EnvironmentConfig>`  | _(see below)_   | Declare non-`dev` layers only; reserved `dev` is injected. At least one other key; exactly one `when: true` unless forced. |
| `css`              | `DevOutlineCssOptions`              | defaults        | Global badge/outline layout and styling.                              |
| `staticMinify`     | `boolean`                           | `true`          | For static builds: route-prune disabled prefixes + cull gated HTML in `dist/`. Set `false` to keep emitted files untouched. |

If you omit `environments`, the integration injects a minimal reserved `dev` plus **`prod`** tied to `NODE_ENV` (or `mode` only if you explicitly override it) so `astroFeatureFlags()` still runs in small demos.

### Reserved name `dev`

The key **`dev`** is reserved: do not list it under `environments`. The integration injects it with `when: mode !== "production"` (mode defaults to `NODE_ENV`) so local **`astro dev`** uses the all-flags-on layer. Configure only shipped layers (`prod`, `staging`, …) yourself.

### `FlagConfig`

| Field              | Type       | Default            | Notes                                     |
| ------------------ | ---------- | ------------------ | ----------------------------------------- |
| `colour` / `color` | `string`   | inherited fallback | Outline/badge color.                      |
| `routes`           | `string[]` | `[]`               | Route wildcard mapping (`/x/*`, `/x/**`). |
| `outline`          | `boolean`  | `true`             | Default toolbar outline state in dev.     |
| `badge`            | `boolean`  | `true`             | Default toolbar badge state in dev.       |

### `EnvironmentConfig`

| Field            | Type                      | Default | Notes                                                                 |
| ---------------- | ------------------------- | ------- | --------------------------------------------------------------------- |
| `when`           | `boolean`                 | unset   | Exactly one environment must have `when: true` (unless forced).       |
| `flags`          | `Record<string, boolean>` | `{}`    | For non-`dev` layers: booleans per flag. Ignored for reserved `dev`. |
| `jsonConfigPath` | `string`                  | unset   | Optional JSON merged when this environment is the active layer (not used on reserved `dev`). |

Merge order:

1. Inline config in `astro.config.mjs`
2. Root `jsonConfigPath` (if set)
3. `environments.<active>.jsonConfigPath` (if set; skipped for `dev`)
4. Process overrides on non-`dev` layers: `AFF_FEATURE_*`, then `ASTRO_FEATURE_FLAGS`

Layer select override: `AFF_ENVIRONMENT=prod`. **`forceEnvironment`** on the integration options wins over **`AFF_ENVIRONMENT`** when both are set, and skips the “exactly one `when: true`” check by pinning the layer directly. In static builds, changing `AFF_ENVIRONMENT` after build does nothing unless you rebuild (or disable `staticMinify` and use a server runtime that evaluates flags at request time).

### DevOutlineCssOptions

| Field                                             | Default                | Meaning                                                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elementBadgeHorizontalAlign`                     | `'end'`                | `'start'` \| `'center'` \| `'end'` — LTR: **`end`** = top-right.                                                                                                                                         |
| `elementBadgeHorizontalPercent`                   | _(unset)_              | 0–100: horizontal anchor with pill centred (`translateX(-50%)`); overrides align.                                                                                                                        |
| `elementBadgeVerticalShiftPercent`                | `80`                   | Vertical shift as **% of the pill height** (default keeps most of the label above the element).                                                                                                          |
| `elementBadgeVerticalAnchor`                      | `'top'`                | `'top'` or `'bottom'`.                                                                                                                                                                                   |

Per-element badge overrides (markup):

- `data-ff-align="start|center|end"`
- `data-ff-horizontal="50"`
- `data-ff-vertical="100"`
- `data-ff-anchor="top|bottom"`

See `example/src/pages/hot-feature-1/index.astro` for all three position controls in use.

## TypeScript

Astro projects typically pick this up automatically from package exports.
If your editor misses virtual module types, add one reference in `src/env.d.ts`.

## Dev toolbar

| Control     | Effect                                                 |
| ----------- | ------------------------------------------------------ |
| **Enabled** | Off → hide nodes carrying that token in `data-ff` (including combined hosts/pages when any member token is Off). |
| **Outline** | Toggle outlines only (element and route frame). For combined hosts this is a non-layout-shifting overlay ring. |
| **Badges**  | Toggle badges only (element pills + route pill).       |
| **Colour**  | `--<namespace>-c-<token>` (persisted).                 |

## Virtual module

Exports include **`FeatureFlag`**, **`FeatureToken`**, **`isAstroDev`**, **`activeEnvironmentKey`**, **`defaultNonDevEnvironment`**, **`flagsForEnvironment`**, **`isFeatureEnabledForEnvironment`**, **`shouldIncludePathForEnvironment`**, **`affDevBootstrap`**, **`routeFeatureTokenForPath`**, **`routeFeatureTokensForPath`**, **`shouldRenderFeature`**, **`matchedFeatureRoutePrefix`**, **`featureFlagStyles`**, etc.

**Programmatic resolution**: `getResolvedFeatures(config)` / `resolveFeatureRuntime(config)` use the same rules as the integration. Set **`forceEnvironment: "prod"`** (or any other key) to pin a layer (e.g. sitemaps generated while `astro` is in dev but routes should match a shipped layer).

**`featureFlagStyles`**: dev-only (outlines, badges, route badges, route-prune overlay). In production it is always an **empty string** — static HTML is cleaned up after build instead. You can still import it so a shared layout keeps one code path; empty `<style>` tags are removed from emitted HTML.

**`featureFlagsByEnvironment`**: frozen map of resolved booleans per `environments` key. The dev bootstrap compares the current URL against each layer and lists which keys would omit that route.

**`defaultNonDevEnvironment`**: prefers `prod` if defined, otherwise the first non-`dev` key (sorted). Use with **`shouldIncludePathForEnvironment(path, defaultNonDevEnvironment)`** (or any explicit key) when you want “primary shipped layer” without hard-coding a name — your non-dev keys can be `staging`, `preview-123`, etc.

## What this package is not

Remote percentage rollouts, per-user experiment assignment, analytics, or a hosted flag service. This is **declarative Astro config** + build-time HTML cleanup + a **local dev toolbar**.

## How-to

- [Hide feature locked pages from sitemaps in production builds](docs/how-to/hide-from-sitemaps.md)

## Example Pages

`example/` — `pnpm install && pnpm dev`.

- `/` integration overview + tagging options
- `/hot-feature-1/` route mapped to `hotFeature1`
- `/hot/` route mapped to `hotFeature2`
- `/hot-dev/sub/` wildcard nested route + combined `wip` + `hotFeature2` element gating

## Tests

```bash
pnpm test
pnpm typecheck
ENABLE_SLOW=1 pnpm test
```

Slow checks that run a real `example` production build plus a small fixture (route pruning, `shouldRenderFeature`, and `data-ff` HTML culling) are documented in [docs/testing.md](./docs/testing.md). Enable them with `ENABLE_SLOW=1`.
