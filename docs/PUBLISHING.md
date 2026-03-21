# Publishing `@at-flux/astroflare` to npm

## “I have the org but I can’t add the package on npm”

npm **does not** give you a “Create package” button for scoped packages the way some registries do. The package **is created automatically on the first successful `npm publish`** to that name, as long as:

1. Your npm user is a member of the **`at-flux`** organization with permission to **publish** (Owner / member role that includes publish — check [org members](https://www.npmjs.com/org/at-flux/members)).
2. The scope in `package.json` matches the org: **`"name": "@at-flux/astroflare"`** (already set in this repo).
3. **2FA**: If the org or your account requires 2FA for publishing, a **local** `npm publish` is fine (you can enter OTP). For **CI**, use **trusted publishing** (below) or an **Automation** token so you don’t get **EOTP**.

**Trusted publishing** (package → Settings → Trusted publishing) usually appears **after the package exists** (i.e. after at least one version is published). Typical order:

1. **First publish** once (see [First publish (bootstrap)](#first-publish-bootstrap)) so `@at-flux/astroflare` appears under the org.
2. Then open **Package → Settings → Trusted publishing** on npm and connect **GitHub Actions** to **`publish.yml`**.
3. Future publishes can use **OIDC only** (no long-lived `NPM_TOKEN`).

---

## Recommended: [Trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers)

This avoids long-lived **`NPM_TOKEN`** secrets and avoids **EOTP** (one-time password) failures in CI when your account uses 2FA.

### Requirements (from npm)

- **npm CLI** ≥ **11.5.1**
- **Node** ≥ **22.14.0** (this repo’s publish job uses Node **24**)
- **GitHub-hosted runners** (self-hosted runners are not supported yet for OIDC trusted publishing)

### Step 1 — npmjs.com

1. Sign in at [npmjs.com](https://www.npmjs.com).
2. Open the package **`@at-flux/astroflare`** → **Settings** → **Trusted publishing** (only after the package exists — see [First publish](#first-publish-bootstrap) if needed).
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

## First publish (bootstrap)

If the package does not exist yet, publish **once** from your machine (or use a one-off CI job with an **Automation** token):

```bash
cd packages/astroflare
pnpm install
pnpm build
npm login   # npm user that is in org at-flux with publish rights
npm publish --access public
```

After that, the package shows under the **at-flux** org and you can configure **Trusted publishing** on npm.

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
