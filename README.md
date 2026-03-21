# astroflare

Monorepo for reusable Astro + Tailwind v4 + Cloudflare Workers libraries.

## Packages

| Package | Description |
|---------|-------------|
| [@at-flux/astroflare](packages/astroflare/) | Headless components, styles, and utilities (npm: `@at-flux/astroflare`) |

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
- **Release** — semantic-release on `main` after CI succeeds. Uses `GITHUB_TOKEN` by default; add repo secret **`GH_PAT`** (fine-grained or classic PAT with `contents` + ability to push) if you want tag pushes to trigger the Publish workflow (default token often does not trigger `workflow_run` from the same repo).
- **Publish** (`.github/workflows/publish.yml`) — publishes `@at-flux/astroflare` after Release. Uses **[trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)** — no long-lived `NPM_TOKEN` in GitHub. On npmjs.com → package **Settings** → **Trusted publishing**, add **GitHub Actions** with org `at-flux`, repo `astroflare`, workflow file **`publish.yml`** (exact name). The publish job already sets `permissions: id-token: write` and installs **npm ≥ 11.5.1** (required for OIDC). **GitHub-hosted runners only** (self-hosted not supported by npm OIDC yet).

See `packages/astroflare/README.md` for import paths and subpackages.
