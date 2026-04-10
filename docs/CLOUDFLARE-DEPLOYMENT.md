# Cloudflare Workers + Astro (`@astrojs/cloudflare`) — deployment

This guide applies to sites that use **`@at-flux/astroflare`** for contact forms (Resend) and the same **Wrangler + static assets** layout as reference projects (e.g. `main` → `./dist/_worker.js/index.js`, `assets.directory` → `./dist`).

## 1. Build output and `.assetsignore` (required)

Astro writes the Worker bundle under **`dist/_worker.js/`**. The same **`dist`** folder is your **static assets** root for Wrangler. Cloudflare **must not** upload `_worker.js` as public static files (it would expose server code).

**Fix:** add `public/.assetsignore` in the Astro project (copied to `dist/` at build time):

```text
_worker.js
_routes.json
```

Without this, deploys can fail with: _Uploading a Pages `_worker.js` directory as an asset_.

## 2. Where each kind of configuration lives

| Kind                         | Purpose                                                     | Typical files / UI                                                                                                          |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Client / build-time**      | Public strings inlined into the browser bundle (no secrets) | Astro `env.schema` + `.env` (optional; can be committed for non-secrets only)                                               |
| **Local Worker secrets**     | Same bindings as production, on your machine                | **`.dev.vars`** at project root (gitignored) — used by `wrangler dev` and `astro dev` with `platformProxy`                  |
| **Non-secret server config** | Routing, feature flags, email local parts/domains           | **`wrangler.jsonc` → `vars`** (often committed; no API keys)                                                                |
| **Secrets**                  | API keys                                                    | **`wrangler secret put <NAME>`** or **Cloudflare dashboard → Workers/Pages → Settings → Variables** (encrypt / secret type) |

Do **not** put `RESEND_API_KEY` in `wrangler.jsonc` `vars` if the file is committed.

## 3. Resend (forms email)

1. Create a [Resend](https://resend.com) account and an **API key**.
2. **Verify** the domain you send from (e.g. `atflux.uk`) in Resend DNS.
3. In **Cloudflare** (or Wrangler), set the secret:
   - **`RESEND_API_KEY`** — the Resend key (`re_...`).

`From` / `To` addresses are usually built from **non-secret** pieces in `vars` (see below), not from the API key.

## 4. Environment variables used by `@at-flux/astroflare` contact-style actions

Example shape (as in consuming apps’ action handlers):

| Variable                      | Role                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`RESEND_API_KEY`**          | Secret — Resend API key                                                                                          |
| **`MOCK_EMAIL_INTEGRATION`**  | Optional — if `"true"`, the library logs instead of sending (use locally; set **`false`** or omit in production) |
| **`FORMS_FROM_EMAIL_LOCAL`**  | Local part of the sender (e.g. `forms`)                                                                          |
| **`FORMS_FROM_EMAIL_DOMAIN`** | Domain (must match Resend-verified domain)                                                                       |
| **`FORMS_TO_EMAIL_LOCAL`**    | Local part of the recipient inbox                                                                                |
| **`FORMS_TO_EMAIL_DOMAIN`**   | Recipient domain                                                                                                 |

Optional extra (only if you implement a **mailing list** action, not the minimal contact form):

| Variable                              | Role                |
| ------------------------------------- | ------------------- |
| **`RESEND_MAILING_LIST_AUDIENCE_ID`** | Resend Audiences ID |

**Local development:** put secrets and `MOCK_EMAIL_INTEGRATION=true` in **`.dev.vars`**. Mirror **`wrangler.jsonc` `vars`** for `FORMS_*` or rely on Wrangler merging vars + `.dev.vars`.

**Production:** set `RESEND_API_KEY` as a **secret**; set `FORMS_*` and `MOCK_EMAIL_INTEGRATION` via **`vars`** in the dashboard or in committed `wrangler.jsonc` (for non-secrets only).

## 5. Worker name vs CI / Pages project

If Cloudflare reports a **Worker name mismatch** (config name vs project name), align them:

- Either change **`wrangler.jsonc` → `name`** to match the Workers/Pages project name, or
- Rename the Cloudflare project to match `wrangler.jsonc`.

Inconsistent names can cause confusing overrides in automated deploys.

## 6. Checklist before going live

- [ ] `public/.assetsignore` includes `_worker.js` (and usually `_routes.json`).
- [ ] `RESEND_API_KEY` set as a **secret** in production; not in git.
- [ ] Domain for **`FORMS_FROM_EMAIL_DOMAIN`** verified in Resend.
- [ ] **`MOCK_EMAIL_INTEGRATION`** is not `"true"` in production (unless you intend dry-run).
- [ ] Worker **`name`** matches the Cloudflare project.

## 7. Reference layout (`wrangler.jsonc`)

```jsonc
{
  "name": "your-worker-name",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2025-09-08",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
  },
  "vars": {
    "FORMS_FROM_EMAIL_LOCAL": "forms",
    "FORMS_FROM_EMAIL_DOMAIN": "example.com",
    "FORMS_TO_EMAIL_LOCAL": "hello",
    "FORMS_TO_EMAIL_DOMAIN": "example.com",
    "MOCK_EMAIL_INTEGRATION": "false",
  },
}
```

Secrets (`RESEND_API_KEY`, and optionally `RESEND_MAILING_LIST_AUDIENCE_ID`) are **not** committed in `wrangler.jsonc`. Configure them locally in **`.dev.vars`** and in production via the **CLI or dashboard** (below).

## 8. Wrangler CLI: production secrets and deploy

Log in once:

```bash
wrangler login
```

Build the Astro site, then deploy the Worker + assets from the project root (where `wrangler.jsonc` lives):

```bash
pnpm build
wrangler deploy
```

### Workers (project uses `wrangler.jsonc` with `main` + `assets`)

Set **encrypted** secrets for the Worker named in `wrangler.jsonc` (`name` field). Wrangler prompts for the value (paste from Resend, etc.):

```bash
wrangler secret put RESEND_API_KEY
```

Optional — only if your app reads **`RESEND_MAILING_LIST_AUDIENCE_ID`** (e.g. mailing-list / Audiences integration):

```bash
wrangler secret put RESEND_MAILING_LIST_AUDIENCE_ID
```

List or remove secrets:

```bash
wrangler secret list
wrangler secret delete RESEND_API_KEY
```

If you use [environments](https://developers.cloudflare.com/workers/wrangler/environments/) in `wrangler.jsonc`, add `--env <name>` to `deploy` and `secret` commands.

Plain **non-secret** `vars` stay in **`wrangler.jsonc`** (or environment-specific overrides there). Redeploy after changing `vars`.

### Cloudflare Pages (Git-connected or `wrangler pages deploy`)

If this site is deployed as **Pages** with the same Worker bundle, use the **Pages** secret commands and your **project name** (as in the Cloudflare dashboard):

```bash
wrangler pages secret put RESEND_API_KEY --project-name=<your-pages-project>
```

Same pattern for `RESEND_MAILING_LIST_AUDIENCE_ID` if needed.

Non-secret text variables can be set under **Pages → Settings → Environment variables** in the dashboard, or via your CI provider’s encrypted variables, consistent with how your pipeline invokes `wrangler pages deploy`.

### Summary

| Variable                            | Local                                            | Production (Worker / Pages)                             |
| ----------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| `FORMS_*`, `MOCK_EMAIL_INTEGRATION` | `wrangler.jsonc` + optional `.dev.vars` override | `wrangler.jsonc` `vars` and/or dashboard **plain** vars |
| `RESEND_API_KEY`                    | `.dev.vars`                                      | `wrangler secret put` or dashboard **Secret**           |
| `RESEND_MAILING_LIST_AUDIENCE_ID`   | `.dev.vars`                                      | `wrangler secret put` or dashboard (if used)            |
