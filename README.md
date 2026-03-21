# astroflare

Monorepo for reusable Astro + Tailwind v4 + Cloudflare Workers libraries.

## Packages

| Package | Description |
|---------|-------------|
| [@at-flux/astroflare](packages/astroflare/) | Headless components, styles, and utilities (npm: `@at-flux/astroflare`) |

## Requirements

- **Node.js** 18+ (CI uses Node 20)
- **pnpm** — version pinned in root `package.json` (`packageManager` field). GitHub Actions use that version via `pnpm/action-setup` (do not set a conflicting `version` in the workflow).

## Development

```bash
pnpm install
pnpm --filter @at-flux/astroflare typecheck
pnpm --filter @at-flux/astroflare test
pnpm --filter @at-flux/astroflare build
```

Root shortcuts:

```bash
pnpm test    # all workspace packages that define test
pnpm build   # all workspace packages that define build
```

## CI

- **CI** (`.github/workflows/ci.yml`) — on push/PR to `main`: install, typecheck, test, build, pack tarball.
- **Release** — semantic-release on `main` after CI (requires `GH_PAT`).
- **Publish** — npm publish for `@at-flux/astroflare` after release (requires `NPM_TOKEN`).

See `packages/astroflare/README.md` for import paths and subpackages.
