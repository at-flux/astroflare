# Publishing `@at-flux/*` packages to npm

## First-time publish (new package name)

Use this flow for the first publish of a new scoped package:

1. Get a short-term npm token with:
   - package write
   - org write (for `at-flux`)
2. Publish once from your machine:

```bash
cd packages/<package>
npm login
npm --workspaces=false config set //registry.npmjs.org/:_authToken=token
pnpm publish --access public
```

Notes:
- The package is created on npm by this first successful publish.
- If you get `404 Not Found` on `PUT .../@at-flux%2f<package>`, the token/user usually does not have publish rights for the org/scope.

## Second publish onward (recommended): [Trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)

After the first publish exists, configure trusted publishing for each package:

npmjs.com → package **Settings** → **Trusted publishing** → **GitHub Actions**

- **Organization or user:** `at-flux`
- **Repository:** `astroflare`
- **Workflow filename:** `release.yml`

Then CI publishes without `NODE_AUTH_TOKEN` using OIDC.

Requirements:
- npm CLI **>= 11.5.1**
- Node **>= 22.14** (repo uses Node 24)

## Repo release notes

This monorepo uses **`@qiwi/multi-semantic-release`**:
- per-package versions/changelogs/tags
- only packages with releasable commits are published

Root-only commits may not release any package unless package paths are touched.
