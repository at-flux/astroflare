# Publishing `@at-flux/*` packages to npm

This monorepo uses **`@qiwi/multi-semantic-release`**: each publishable package has its **own semver**, **own changelog** (`packages/<name>/CHANGELOG.md`), **own git tags** (default format `name@version`, e.g. `@at-flux/dom@0.1.0`), and **`npm publish` runs only for packages that had releasable commits**.

Packages: **`@at-flux/astroflare`**, **`@at-flux/dom`**, **`@at-flux/astro-feature-flags`**.

### Versioning from `0.0.1`

Published packages start at **`0.0.0`** in `package.json`. The first successful release on `main` is **`0.0.1`**: `feat` / `fix` / `perf` / etc. are treated as **patch** bumps while you stay on the `0.0.x` line (see `.releaserc.json`). **Breaking** commits still trigger **major** (e.g. `1.0.0`).

If you reset git tags (e.g. fresh npm history), delete old tags locally and on the remote, then push; the next release still follows commits + current `package.json` versions.

## “I have the org but I can’t add the package on npm”

npm **does not** give you a “Create package” button for scoped packages the way some registries do. The package **is created automatically on the first successful `npm publish`** to that name, as long as:

1. Your npm user is a member of the **`at-flux`** organization with permission to **publish**.
2. The scope in `package.json` matches the org: **`@at-flux/…`**.
3. **2FA**: For **CI**, use **trusted publishing** (below) or an **Automation** token so you don’t get **EOTP**.

## Recommended: [Trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)

Configure **each** published package on npmjs.com → **Settings** → **Trusted publishing** → **GitHub Actions** (repeat for every scope package, including **`@at-flux/astro-feature-flags`**):

- **Organization or user:** `at-flux`
- **Repository:** `astroflare`
- **Workflow filename:** `release.yml` (filename only, with extension)

The **Release** workflow (`.github/workflows/release.yml`) runs after CI succeeds on `main`, executes `multi-semantic-release`, and publishes changed packages with:

- `permissions: id-token: write`
- `npm install -g npm@^11.5.1` before publish
- **No** `NODE_AUTH_TOKEN` on the publish step (OIDC)

Requirements from npm: **npm CLI ≥ 11.5.1**, **Node ≥ 22.14** (this repo uses Node **24**).

### `npm error 404 Not Found` on `PUT …/@scope%2fpackage`

Usually either **trusted publishing is not registered for that exact package name**, or the npm user/token **cannot create or publish** under the **`@at-flux`** org.

1. In npm → **Organizations** → **at-flux** → ensure the GitHub Actions publisher (or your user) has **publish** access.
2. On the **package** page (after it exists) or via first manual publish: add **Trusted publishing** with workflow **`release.yml`** for `at-flux/astroflare`.
3. **First publish of a new scoped name**: an org owner often must run once locally after `npm login` and a built `dist/`:  
   `cd packages/<name> && pnpm build && npm publish --access public`  
   so the package exists; OIDC can then publish subsequent versions from CI.

## Root-only changes vs bumping every package

`multi-semantic-release` scopes commits **per package path**. Commits that only touch repo root (e.g. CI, `pnpm` config) may **not** produce a release for any package unless you also change something under `packages/*`.

**If you need every package to release after a root-only change**, pick one:

- Make a small intentional change under each package you want to release (e.g. README), or
- Use a **conventional commit** that touches those paths, or
- Run a **manual** `pnpm publish` from your machine for the packages you need (after bumping versions as appropriate).

## Release workflow note (`npm version` vs pnpm)

The repo does **not** use `@semantic-release/npm` to bump versions: its `npm version` step can fail in CI with **pnpm workspaces** and **npm 11+** (`Cannot read properties of null (reading 'matches')`). Instead, **`scripts/semantic-release-set-version.mjs`** runs in the **prepare** step via `@semantic-release/exec`, then **`pnpm publish`** runs in the publish step.

## Manual publish (bootstrap or emergency)

```bash
cd packages/dom   # or packages/astroflare
pnpm install
pnpm build
npm login
pnpm publish --access public
```

## Alternative: token-based publish (not recommended)

If you cannot use trusted publishing yet, use an **Automation** token and wire `NODE_AUTH_TOKEN` into a custom publish step (classic tokens + 2FA often cause **EOTP** in CI).
