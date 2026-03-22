# Publishing `@at-flux/astroflare` to npm

## Recommended: [Trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)

This avoids long-lived **`NPM_TOKEN`** secrets and avoids **EOTP** (one-time password) failures in CI when your account uses 2FA.

### Requirements (from npm)

- **npm CLI** ≥ **11.5.1**
- **Node** ≥ **22.14.0** (this repo’s publish job uses Node **24**)
- **GitHub-hosted runners** (self-hosted runners are not supported yet for OIDC trusted publishing)

### Step 1 — npmjs.com

1. Sign in at [npmjs.com](https://www.npmjs.com).
2. Open the package **`@at-flux/astroflare`** → **Settings** → **Trusted publishing** (or create the package / scope access first).
3. Under **Select your publisher**, choose **GitHub Actions**.
4. Fill in exactly (case-sensitive):
   - **Organization or user:** `at-flux`
   - **Repository:** `astroflare`
   - **Workflow filename:** `publish.yml` (filename only, with extension)

Each package can only have **one** trusted publisher at a time.

### Step 2 — GitHub Actions (this repo)

The workflow **`.github/workflows/publish.yml`** already includes:

- `permissions: id-token: write` on the publish job (required for OIDC).
- `npm install -g npm@^11.5.1` before `npm publish`.
- **No** `NODE_AUTH_TOKEN` on the publish step (OIDC is used instead).

After you save the trusted publisher on npm, the next successful publish from that workflow should authenticate via OIDC.

### Optional: lock down token publishing

After OIDC works, npm recommends restricting classic token publishes: package **Settings** → **Publishing access** → require 2FA and disallow tokens (see npm docs).

---

## Alternative: token-based publish (not recommended)

If you cannot use trusted publishing yet:

1. Create an **Automation** (classic) or **granular** token with publish rights and **bypass 2FA** for automation where npm allows it.
2. Add it as repo secret **`NPM_TOKEN`**.
3. Temporarily add back to the publish step:

   ```yaml
   env:
     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

Classic tokens + 2FA often produce **EOTP** in CI; prefer **Automation** tokens or OIDC.

---

## Relation to `joy-goodbye`

The joyous-departures repo uses the same pattern: **`id-token: write`**, **`npm install -g npm@latest`**, and historically **`NODE_AUTH_TOKEN`**. Moving that repo to **trusted publishing** means removing **`NODE_AUTH_TOKEN`** from the publish step and registering the same workflow file on npm for that package.
