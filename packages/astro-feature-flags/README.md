# @at-flux/astro-feature-flags

[![npm version](https://img.shields.io/npm/v/@at-flux/astro-feature-flags.svg)](https://www.npmjs.com/package/@at-flux/astro-feature-flags)
[![CI](https://github.com/at-flux/astroflare/actions/workflows/ci.yml/badge.svg)](https://github.com/at-flux/astroflare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Feature flags for Astro with a minimal integration:
- JSON config (`ff.json`)
- element gating (`data-ff`)
- optional route gating/pruning
- dev toolbar for outlines/badges/colours

## Quickstart

1) Add the integration:

```js
import astroFeatureFlags from '@at-flux/astro-feature-flags';

export default defineConfig({
  integrations: [
    astroFeatureFlags({
      root: process.cwd(),
      mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      baseName: 'ff',
      // optional: FF_ENV=preview -> ff.preview.json
      ffEnv: process.env.FF_ENV,
    }),
  ],
});
```

2) Create `ff.json` at the project root:

```json
{
  "flags": { "dev": true, "hotFeature2": true },
  "routes": { "/blog/*": "dev", "/hot/": "hotFeature2" },
  "colors": { "dev": "rgb(220 38 38)", "hotFeature2": "rgb(37 99 235)" }
}
```

3) Use it in templates:
- per-element: `data-ff={FeatureToken.HotFeature2}`
- per-layout route pill (dev): `data-ff-route={routeFeatureTokenForPath(Astro.url.pathname)}`

## Applying flags in Astro

### 1) Per-element (`data-ff`)

```astro
---
import { FeatureToken } from 'virtual:astro-feature-flags';
---

<section data-ff={FeatureToken.Dev}>Dev-only highlighted region</section>
<aside data-ff="dev hot-feature-2">Multiple flags on one node</aside>
```

Use `FeatureToken` for markup (slug values like `hot-feature-2`).

### 2) Per-layout route pill + toolbar bootstrap (dev)

```astro
---
import {
  affDevBootstrap,
  featureFlagStyles,
  routeFeatureTokenForPath,
} from 'virtual:astro-feature-flags';

const routeToken = import.meta.env.DEV
  ? routeFeatureTokenForPath(Astro.url.pathname)
  : undefined;
---

<html data-ff-route={routeToken}>
  <head>
    {import.meta.env.DEV && affDevBootstrap && <script is:inline set:html={affDevBootstrap} />}
    <style is:inline set:html={featureFlagStyles}></style>
  </head>
</html>
```

### 3) SSR/render gating

Use `FeatureFlag` (JSON flag names) for logic:

```ts
import { FeatureFlag, shouldRenderFeature } from 'virtual:astro-feature-flags';
```

`shouldRenderFeature()` and `isFeatureEnabled()` follow config/env values.  
The dev toolbar changes client-side preview state only.

## Config reference

Load order:
1. `ff.json`
2. `ff.<env>.json` (when `ffEnv` or `FF_ENV` is set)
3. `ff.prod.json` (production only)

Route patterns are normalized prefix matches:
- `/blog/*` -> `/blog/` and descendants
- `/blog/**` -> same behavior

Env override format: `AFF_FEATURE_<TOKEN>` (uppercased slug token).

## Optional CSS options

| Field | Default | Meaning |
|-------|---------|---------|
| `elementBadgeHorizontalAlign` | `'end'` | `'start'` \| `'center'` \| `'end'` — LTR: **`end`** = top-right. |
| `elementBadgeHorizontalPercent` | _(unset)_ | 0–100: horizontal anchor with pill centred (`translateX(-50%)`); overrides align. |
| `elementBadgeVerticalShiftPercent` | `80` | Vertical shift as **% of the pill height** (default keeps most of the label above the host). |
| `elementBadgeVerticalAnchor` | `'top'` | `'top'` or `'bottom'`. |

Outlines stay layout-stable when disabled (transparent stroke, same geometry).  
Route pill uses `data-ff-route` and does not react to page hover.

## TypeScript

Reference **`virtual-astro-feature-flags.d.ts`** from the package (see **`src/env.d.ts`** in this repo’s site, or **`/// <reference path="…/virtual-astro-feature-flags.d.ts" />`**).

## Dev toolbar

| Control | Effect |
|--------|--------|
| **Enabled** | Off → hide nodes carrying that token in `data-ff`. |
| **Outline** | Visible stroke vs **transparent** (same width/offset). |
| **Badges** | Element pills + route pill. |
| **Colour** | `--aff-c-<token>` (persisted). |

## Virtual module

Exports include **`FeatureFlag`**, **`FeatureToken`**, **`affDevBootstrap`**, **`routeFeatureTokenForPath`**, **`shouldRenderFeature`**, **`matchedFeatureRoutePrefix`**, **`featureFlagStyles`**, etc.

## Example

`example/` — `pnpm install` && `pnpm dev`. The home page demonstrates **`data-ff`**, route mapping, and the toolbar; **`Layout.astro`** shows the full dev bootstrap.

## Tests

```bash
pnpm test
```
