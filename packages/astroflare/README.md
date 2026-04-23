# @at-flux/astroflare

[![npm version](https://img.shields.io/npm/v/@at-flux/astroflare.svg)](https://www.npmjs.com/package/@at-flux/astroflare)
[![CI](https://github.com/at-flux/astroflare/actions/workflows/ci.yml/badge.svg)](https://github.com/at-flux/astroflare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Reusable headless components, styles, and utilities for Astro + Tailwind v4 + Cloudflare projects.

For type-safe DOM helpers, use the separate package **`@at-flux/dom`**.

## Package entrypoints

| Subpath                            | Contents                                      |
| ---------------------------------- | --------------------------------------------- |
| `@at-flux/astroflare`              | **Core** — forms utilities (same as `./core`) |
| `@at-flux/astroflare/core`         | Forms; also exposes the `forms` namespace     |
| `@at-flux/astroflare/forms`        | Resend email + form HTML helpers              |
| `@at-flux/astroflare/components/*` | Astro components (source)                     |
| `@at-flux/astroflare/styles/*`     | CSS (source)                                  |

### Examples

```ts
// Flat imports from core
import { sendEmail } from "@at-flux/astroflare";

// Explicit subpaths
import { renderEmailTemplate } from "@at-flux/astroflare/forms";

// Namespaced (from core / root)
import { forms } from "@at-flux/astroflare/core";
```

## Contents

### Components (Astro)

- `Modal.astro` — Headless modal using native `<dialog>` and `<app-modal>` web component (`class` applies to the panel)
- `ModalTrigger.astro` — Trigger that opens a modal by ID using `<modal-trigger>` web component
- `ContactModalCta.astro` — Opinionated contact button (solid pill or text link) wrapped in `ModalTrigger`
- `InstagramProfileLink.astro` — Small Instagram icon + `@handle` link with safe defaults
- `Section.astro` — Page section with optional `narrow` and `contentOnly` (inner width wrapper without outer padding)
- `ThemeToggle.astro` — Dark/light mode toggle using `<theme-toggle>` web component
- `IconButton.astro` — Accessible icon-only control that renders `<button>` or `<a>`
- `ClientRouterLoadingSpinner.astro` — Loading spinner for Astro view transitions
- `Tooltip.astro` — Lightweight hover/focus tooltip wrapper for compact metadata summaries
- `ListSummary.astro` — Generic inline list truncation with `+N` overflow and tooltip details
- `TagSummary.astro` — Generic deterministic tag pill list with `+N` tooltip overflow
- `MediaProtect.astro` — Style-agnostic media wrapper that applies no-save classes with delegated drag/context-menu protection
- `FilterPills.astro` — Tag-colored filter chips with an `all` option and active-state styling
- `Pager.astro` — Pagination UI primitive for both browser-only and link-driven query pagination
- `CollectionQuery.astro` — Unified collection filtering/pagination component (client mode by default; URL-driven server mode with `useServer`)

#### Component props reference

- `Modal.astro`: `id`, `class`, `backdropClass`, `panelClass`, `closeButtonClass`, `contentClass`
- `ModalTrigger.astro`: `modalId`, `class`
- `ContactModalCta.astro`: `modalId`, `label`, `variant`, `class`
- `InstagramProfileLink.astro`: `handle`, `href`, `class`, `aria-label`
- `Section.astro`: `id`, `class`, `narrow`, `contentOnly`
- `ThemeToggle.astro`: `class`
- `IconButton.astro`: `label`, `href`, `class`, `id`, passthrough attributes
- `Tooltip.astro`: `text`, `position`, `class`, `panelClass`
- `ListSummary.astro`: `items`, `visibleCount`, `separator`, `class`, `emptyLabel`, `overflowClass`, `tooltipPosition`, `itemCase`
- `TagSummary.astro`: `items`, `visibleCount`, `class`, `itemClass`, `overflowClass`, `itemCase`, `colorOverrides`
- `MediaProtect.astro`: `class`, `containerClass`, `drag`, `contextMenu`
- `FilterPills.astro`: `items`, `includeAll`, `allLabel`, `allHref`, `active`, `itemCase`, `colorOverrides`, `class`
- `Pager.astro`: `pageCount`, `activePage`, `items`, `class`
- `CollectionQuery.astro`: `useServer`, `pathname`, `query`, `totalPages`, `currentPage`, `filters`, `maxPageButtons`, `filtersClass`, `pagerClass`, `perPage`, `class`
  - when `useServer` is `true`, `pathname`, `query`, `totalPages`, and `currentPage` are required

### Server Islands Pattern

`CollectionQuery.astro` supports two modes:

- client mode (default): static cards are filtered/paged in the browser
- server mode (`useServer`): renders querystring links for filters + pager

For server mode, mount with `server:defer` at the page callsite:

```astro
<CollectionQuery
  useServer
  pathname={Astro.url.pathname}
  query={activeQuery}
  totalPages={pageData.totalPages}
  currentPage={currentPage}
  filters={filters}
  server:defer
/>
```

The package styleguide uses the Node adapter, so the server-island pattern can be exercised there with `server:defer`.

### Slot customization (headless overrides)

Use named slots to replace the default filter/pager rendering:

```astro
<CollectionQuery useServer {...props}>
  <div slot="filters">
    <!-- your custom filter UI -->
  </div>

  <!-- default slot: your collection items -->
  <div>...</div>

  <div slot="pager">
    <!-- your custom pager UI -->
  </div>
</CollectionQuery>
```

### Styles (CSS)

- `styles/prose.css` — Markdown prose styling using CSS custom properties
- `styles/no-save.css` — Image protection utilities (prevent right-click, drag, select)
- `styles/accessibility.css` — Focus styles, reduced motion, selection styling
- `styles/scrollbar.css` — Branded scrollbar styling

### Utilities

- `getTagPalette(tag, options?)` — Deterministic, readable tag color assignment with optional explicit overrides
- `formatDisplayDate(date, config?)` — Consistent card/detail date formatting with locale override support
- `parseCollectionQuery(searchParams, options?)` + `paginateCollection(list, query)` + `buildCollectionHref(path, query, overrides?)` + `buildPageSequence(total, current, max?)` + `matchesCollectionFilters(values, filters)` — URL-driven filtering and pagination helpers (`filters` query param supports stringified JSON for multi-filter payloads)

## Usage

### Local checkout without changing package.json or lockfile

Keep **`@at-flux/astroflare`** on a normal semver range in `package.json` and run **`pnpm install`** so the lockfile records the registry version. Then overlay the install with a symlink (only under `node_modules`):

```bash
pnpm exec astroflare-link-local link /absolute/or/relative/path/to/astroflare/packages/astroflare
# or
ASTROFLARE_LOCAL_PATH=../../ts-libs/astroflare/packages/astroflare pnpm exec astroflare-link-local
```

- **`USE_LOCAL_ASTROFLARE=1`** (or `true` / `yes`) is supported only together with **`ASTROFLARE_LOCAL_PATH`** or **`USE_LOCAL_ASTROFLARE_PATH`** (path to `packages/astroflare`).
- **`unlink`** removes the overlay and runs **`pnpm install`** again so `node_modules` matches the lockfile:

```bash
pnpm exec astroflare-link-local unlink
```

- **`status`** shows whether an overlay is active.

Re-running **`pnpm install`** may replace the symlink with the store copy; run **`link`** again if that happens.

### Local Import (file: protocol) — alternative

```json
{
  "dependencies": {
    "@at-flux/astroflare": "file:../../ts-libs/astroflare/packages/astroflare"
  }
}
```

### Components

```astro
---
import Modal from '@at-flux/astroflare/components/Modal.astro';
import ModalTrigger from '@at-flux/astroflare/components/ModalTrigger.astro';
---
```

### Styles

```css
@import "@at-flux/astroflare/styles/prose.css";
@import "@at-flux/astroflare/styles/no-save.css";
```

## Testing

From repo root:

```bash
pnpm install
pnpm --filter @at-flux/astroflare test
```

Or in `packages/astroflare`:

```bash
pnpm test
```

## Styleguide (dev-only)

Use the package-local styleguide to preview all astroflare components in one place.

```bash
pnpm styleguide:dev
```
