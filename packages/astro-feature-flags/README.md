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

- per-flag declaration (`colour`/`color` for highlighting in Astro's dev mode, optional `routes` for matching pages)
- named environments (`dev`, `prod`, etc.)
- element gating via namespaced attributes (`data-ff` or `data-ff-<token>` by default)
- production static HTML: gated `data-ff` nodes culled, dev-only CSS not shipped (`featureFlagStyles` is empty); `data-ff-route*` stripped from `<html>`
- route badge + production route pruning
- dev toolbar for enabled/outline/badge/colour preview (toolbar also hides **route** frame/pill per flag; routes omitted in **production** show a dim overlay in dev)

## Quickstart

1. Configure in `astro.config.mjs`:

   ```js
   import astroFeatureFlags from "@at-flux/astro-feature-flags";

   export default defineConfig({
     integrations: [
       astroFeatureFlags({
         root: process.cwd(),
         flags: {
           dev: {
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
           dev: {
             when: process.env.NODE_ENV !== "production",
             flags: {
               dev: true,
               hotFeature1: true,
               hotFeature2: true,
             },
           },
           prod: {
             when: process.env.NODE_ENV === "production",
             flags: {
               dev: false,
               hotFeature1: true,
               hotFeature2: false,
             },
           },
         },
       }),
     ],
   });
   ```

2. Optional `ff.json` deep override:

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
   - `data-ff={[FeatureToken.Dev, FeatureToken.HotFeature2].join(' ')}`
   - `data-ff="dev hot-feature-2"` **(no import!)**
   - `data-ff-dev` **(no import!)**
   - `data-ff-hot-feature-2` **(no import!)**

> [!NOTE]
> Flags are combinatory. If an element has `data-ff="dev hot-feature-2"`, both flags must be enabled.
> The same applies in dev toolbar preview: turning either one off hides the element.
> In **production** static builds, nodes that fail that check are **removed from the HTML** (not merely hidden). Prefer **`shouldRenderFeature`** when you need compile-time omission with no trace in `dist/`.

## Common Use Cases

### 1) Per-element token (imported)

```tsx
---
import { FeatureToken } from 'virtual:astro-feature-flags';
---

<section data-ff={FeatureToken.Dev}>Dev section</section>
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
<section data-ff-dev>Dev section</section>
<aside data-ff-hot-feature-2>Hot section</aside>
```

`data-ff-dev` is equivalent to `data-ff={FeatureToken.Dev}` or `data-ff="dev"`.

If `tokenNamespace` is `aff`, use `data-aff` / `data-aff-<token>` instead.

### 2b) Combined flags (AND behavior)

Both flags must be enabled:

```tsx
<div data-ff-dev data-ff-hot-feature-2>
  ...
</div>
```

Or using `data-ff` with values:

```tsx
---
import { FeatureFlag } from 'virtual:astro-feature-flags';
---

<div data-ff={[FeatureFlag.Dev, FeatureFlag.HotFeature2].join(' ')}>...</div>
// OR
<div data-ff="dev hot-feature-2">...</div>
```

`data-ff` expects a space-separated list of feature flags.

### 3) Per-layout route pill + toolbar bootstrap (dev)

```tsx
---
import {
  affDevBootstrap,
  featureFlagStyles,
  routeFeatureTokensForPath,
} from 'virtual:astro-feature-flags';

const routeTokens = routeFeatureTokensForPath(Astro.url.pathname);
---

<html data-ff-route={routeTokens.join(' ')}>
  <head>
    {affDevBootstrap && <script is:inline set:html={affDevBootstrap} />}
    <style is:inline set:html={featureFlagStyles}></style>
  </head>
</html>
```

### 4) Logic usage (`FeatureFlag`)

Use this when you need explicit conditional logic in frontmatter (most UI cases can stay markup-only with `data-ff-*`):

```ts
import { FeatureFlag, shouldRenderFeature } from "virtual:astro-feature-flags";
```

`shouldRenderFeature()` and `isFeatureEnabled()` follow config/env values.\
The dev toolbar changes client-side preview state only.

## Configuration Schema

### Top-level options

| Option           | Type                                | Default         | Notes                                                   |
| ---------------- | ----------------------------------- | --------------- | ------------------------------------------------------- |
| `jsonConfigPath` | `string`                            | unset           | Direct path to JSON config file.                        |
| `root`           | `string`                            | `process.cwd()` | Base directory for `<baseName>.json` lookup.            |
| `baseName`       | `string`                            | `'ff'`          | Reads `<baseName>.json` when `jsonConfigPath` is unset. |
| `tokenNamespace` | `string`                            | `'ff'`          | CSS var namespace (`--ff-c-*`).                         |
| `flags`          | `Record<string, FlagConfig>`        | `{}`            | Flag declarations.                                      |
| `environments`   | `Record<string, EnvironmentConfig>` | `{}`            | Environment flag values + optional `when`.              |
| `css`            | `DevOutlineCssOptions`              | defaults        | Global badge/outline layout and styling.                |

### `FlagConfig`

| Field              | Type       | Default            | Notes                                     |
| ------------------ | ---------- | ------------------ | ----------------------------------------- |
| `colour` / `color` | `string`   | inherited fallback | Outline/badge color.                      |
| `routes`           | `string[]` | `[]`               | Route wildcard mapping (`/x/*`, `/x/**`). |
| `outline`          | `boolean`  | `true`             | Default toolbar outline state in dev.     |
| `badge`            | `boolean`  | `true`             | Default toolbar badge state in dev.       |

### `EnvironmentConfig`

| Field   | Type                      | Default | Notes                                  |
| ------- | ------------------------- | ------- | -------------------------------------- |
| `when`  | `boolean`                 | unset   | If true, this environment is selected. |
| `flags` | `Record<string, boolean>` | `{}`    | Enabled/disabled per flag.             |

Merge order:

1. inline config in `astro.config.mjs`
2. `ff.json` (deep-merge over inline)
3. Environment variable map via `ASTRO_FEATURE_FLAGS`

Environment select override: `AFF_ENVIRONMENT=prod`  
Flag map override (highest precedence): `ASTRO_FEATURE_FLAGS='{"dev":true,"hotFeature2":false}'`  
Per-flag env override: `AFF_FEATURE_<TOKEN>` (`hotFeature2` -> `AFF_FEATURE_HOT_FEATURE_2`).

### DevOutlineCssOptions

| Field                                             | Default                | Meaning                                                                                                                                                                                                  |
| ------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `elementBadgeHorizontalAlign`                     | `'end'`                | `'start'` \| `'center'` \| `'end'` — LTR: **`end`** = top-right.                                                                                                                                         |
| `elementBadgeHorizontalPercent`                   | _(unset)_              | 0–100: horizontal anchor with pill centred (`translateX(-50%)`); overrides align.                                                                                                                        |
| `elementBadgeVerticalShiftPercent`                | `80`                   | Vertical shift as **% of the pill height** (default keeps most of the label above the host).                                                                                                             |
| `elementBadgeVerticalAnchor`                      | `'top'`                | `'top'` or `'bottom'`.                                                                                                                                                                                   |
| `outlineWidth` / `outlineOffset` / `outlineStyle` | `2px`, `-2px`, `solid` | **Single-token** dev outlines only (`outline` / `dotted` / `dashed`). Combo (multi-token) element rings and the page route frame always use **solid** gradient rings — these options do not change them. |

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
| **Enabled** | Off → hide nodes carrying that token in `data-ff`.     |
| **Outline** | Visible stroke vs **transparent** (same width/offset). |
| **Badges**  | Element pills + route pill.                            |
| **Colour**  | `--<namespace>-c-<token>` (persisted).                 |

## Virtual module

Exports include **`FeatureFlag`**, **`FeatureToken`**, **`affDevBootstrap`**, **`routeFeatureTokenForPath`**, **`routeFeatureTokensForPath`**, **`shouldRenderFeature`**, **`matchedFeatureRoutePrefix`**, **`featureFlagStyles`**, etc.

**`featureFlagStyles`**: dev-only (outlines, badges, route frame, route-prune overlay). In production it is always an **empty string** — static HTML is cleaned up after build instead (see note above). You can still import it so a shared layout keeps one code path; empty `<style>` tags are removed from emitted HTML.

**`featureFlagsProduction`**: frozen map used by **`shouldIncludePathInProduction`**, **`isFeatureEnabledProduction`**, and the dev bootstrap route preview (dim overlay when the current URL would be pruned in production).

## How-to

- `docs/how-to/hide-from-sitemaps.md`

## Example Pages

`example/` — `pnpm install && pnpm dev`.

- `/` integration overview + tagging options
- `/hot-feature-1/` route mapped to `hotFeature1`
- `/hot/` route mapped to `hotFeature2`
- `/hot-dev/sub/` wildcard nested route + combined `dev` + `hotFeature2` element gating

## Tests

```bash
pnpm test
pnpm typecheck
```

Slow checks that run a real `example` production build plus a small fixture (route pruning, `shouldRenderFeature`, and `data-ff` HTML culling) are documented in [docs/testing.md](./docs/testing.md). Enable them with `ENABLE_SLOW=1`.
