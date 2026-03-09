# @atflux/astroflare

Reusable headless components, styles, and utilities for Astro + Tailwind v4 + Cloudflare projects.

## Contents

### Client Utilities

- `client/dom.ts` -- Type-safe DOM helpers (`getElementById`, `getElementByQuery`, and throwing variants)

### Components (Astro)

- `Modal.astro` -- Headless modal using native `<dialog>` and `<app-modal>` web component
- `ModalTrigger.astro` -- Trigger that opens a modal by ID using `<modal-trigger>` web component
- `ThemeToggle.astro` -- Dark/light mode toggle using `<theme-toggle>` web component
- `ClientRouterLoadingSpinner.astro` -- Loading spinner for Astro view transitions

### Styles (CSS)

- `styles/prose.css` -- Markdown prose styling using CSS custom properties
- `styles/no-save.css` -- Image protection utilities (prevent right-click, drag, select)
- `styles/accessibility.css` -- Focus styles, reduced motion, selection styling
- `styles/scrollbar.css` -- Branded scrollbar styling

## Usage

### Local Import (file: protocol)

```json
{
  "dependencies": {
    "@atflux/astroflare": "file:../../ts-libs/astroflare/packages/astroflare"
  }
}
```

### Components

```astro
---
import Modal from '@atflux/astroflare/components/Modal.astro';
import ModalTrigger from '@atflux/astroflare/components/ModalTrigger.astro';
---
```

### Client Utilities

```ts
import { getElementById, getElementByQuery } from '@atflux/astroflare/client/dom';
```

### Styles

```css
@import '@atflux/astroflare/styles/prose.css';
@import '@atflux/astroflare/styles/no-save.css';
```

## Testing

```bash
pnpm test
```
