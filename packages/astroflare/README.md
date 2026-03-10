# @at-flux/astroflare

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

### Client Utilities

```ts
import { getElementById, getElementByQuery } from '@at-flux/astroflare/client/dom';
```

### Styles

```css
@import '@at-flux/astroflare/styles/prose.css';
@import '@at-flux/astroflare/styles/no-save.css';
```

## Testing

```bash
pnpm test
```
