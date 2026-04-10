# astroflare

Monorepo for reusable Astro + Tailwind v4 + Cloudflare Workers libraries.

## Packages

| Package | Description |
|---------|-------------|
| [@at-flux/astroflare](packages/astroflare/) | Headless components, styles, and utilities |
| [@at-flux/dom](packages/dom/) | Type-safe DOM helpers (standalone package; import from `@at-flux/dom`) |
| [@at-flux/astro-feature-flags](packages/astro-feature-flags/) | Astro integration for JSON feature flags, route gating, and dev-toolbar previews |

## Requirements

- **Node.js** 24.x (matches `engines` in root `package.json`; CI uses Node 24 + actions on the Node 24 runtime)
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
- **Release** — `@qiwi/multi-semantic-release` on `main` after CI succeeds: **independent versions** per package, publish only what changed (uses **`GITHUB_TOKEN`**). **[npm trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)** — register workflow **`release.yml`** on npm for each package. See **[docs/PUBLISHING.md](docs/PUBLISHING.md)**. If release fails with **tag already exists** / **no previous release**, see **[docs/RELEASE-TROUBLESHOOTING.md](docs/RELEASE-TROUBLESHOOTING.md)**.

See `packages/astroflare/README.md` for import paths and subpackages.
