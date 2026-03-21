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

- `Modal.astro` — Headless modal using native `<dialog>` and `<app-modal>` web component
- `ModalTrigger.astro` — Trigger that opens a modal by ID using `<modal-trigger>` web component
- `ThemeToggle.astro` — Dark/light mode toggle using `<theme-toggle>` web component
- `ClientRouterLoadingSpinner.astro` — Loading spinner for Astro view transitions

### Styles (CSS)

- `styles/prose.css` — Markdown prose styling using CSS custom properties
- `styles/no-save.css` — Image protection utilities (prevent right-click, drag, select)
- `styles/accessibility.css` — Focus styles, reduced motion, selection styling
- `styles/scrollbar.css` — Branded scrollbar styling

## Usage

### Local Import (file: protocol)

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
