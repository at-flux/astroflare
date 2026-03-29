# @at-flux/astroflare

Reusable headless components, styles, and utilities for Astro + Tailwind v4 + Cloudflare projects.

For type-safe DOM helpers, use the separate package **`@at-flux/dom`**.

**There is no `@at-flux/astroflare/dom` subpath** (it is not published and must not be used). Add `@at-flux/dom` as its own dependency.

## Package entrypoints

| Subpath | Contents |
|---------|----------|
| `@at-flux/astroflare` | **Core** — forms utilities (same as `./core`) |
| `@at-flux/astroflare/core` | Forms; also exposes the `forms` namespace |
| `@at-flux/astroflare/forms` | Resend email + form HTML helpers |
| `@at-flux/astroflare/components/*` | Astro components (source) |
| `@at-flux/astroflare/styles/*` | CSS (source) |

### Examples

```ts
// Flat imports from core
import { sendEmail } from '@at-flux/astroflare';

// Explicit subpaths
import { renderEmailTemplate } from '@at-flux/astroflare/forms';

// Namespaced (from core / root)
import { forms } from '@at-flux/astroflare/core';
```

## Contents

### Components (Astro)

- `Modal.astro` — Headless modal using native `<dialog>` and `<app-modal>` web component (`class` applies to the panel)
- `ModalTrigger.astro` — Trigger that opens a modal by ID using `<modal-trigger>` web component
- `ContactModalCta.astro` — Opinionated contact button (solid pill or text link) wrapped in `ModalTrigger`
- `InstagramProfileLink.astro` — Small Instagram icon + `@handle` link with safe defaults
- `Section.astro` — Page section with optional `narrow` and `contentOnly` (inner width wrapper without outer padding)
- `ThemeToggle.astro` — Dark/light mode toggle using `<theme-toggle>` web component
- `ClientRouterLoadingSpinner.astro` — Loading spinner for Astro view transitions

### Styles (CSS)

- `styles/prose.css` — Markdown prose styling using CSS custom properties
- `styles/no-save.css` — Image protection utilities (prevent right-click, drag, select)
- `styles/accessibility.css` — Focus styles, reduced motion, selection styling
- `styles/scrollbar.css` — Branded scrollbar styling

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
@import '@at-flux/astroflare/styles/prose.css';
@import '@at-flux/astroflare/styles/no-save.css';
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
