# Release troubleshooting (multi-semantic-release)

## CI: `Verify release tags are on main` fails (e.g. `@at-flux/dom@1.0.0`)

The workflow runs `scripts/verify-release-tags-on-main.mjs`. It fails if any tag matching `@at-flux/<pkg>@x.y.z` **exists** but is **not an ancestor of `main`** — the same condition that breaks `semantic-release` (it uses `git tag --merged main`).

**Fix:** For each tag listed in the log, use **re-point or delete** in the section below with that exact tag name (e.g. `@at-flux/dom@1.0.0`, `@at-flux/astroflare@1.0.0`).

## `fatal: tag '@at-flux/<pkg>@x.y.z' already exists`

**What happened:** `semantic-release` decided the next version was `x.y.z` and tried to create that git tag, but a tag with that name **already exists** in the repo.

**Typical cause:** The tag exists, but it is **not reachable from `main`** (`git tag --merged main` does not list it). That happens if:

- The tag was created on a commit that was never merged into `main`, or
- `main` was rebased or history-rewritten after the tag was created, or
- The tag was pushed from a different branch and the merge graph does not include that commit on `main`.

In that state, semantic-release behaves like there is **no previous release** (so it may pick `1.0.0` again) while `git tag` still refuses to create a duplicate name.

### Fix (pick one)

1. **Re-point the tag at a commit on `main`** (if the version is correct and npm already matches):

   ```bash
   git fetch origin main
   git tag -f '@at-flux/dom@1.0.0' origin/main
   git push origin 'refs/tags/@at-flux/dom@1.0.0' --force
   ```

   Replace the scope (`dom` / `astroflare`) and version in the tag to match your case.

2. **Delete the orphan tag** (only if you are sure it should not exist and npm state matches your plan):

   ```bash
   git push origin ':refs/tags/@at-flux/dom@1.0.0'
   ```

   After deletion, the **next** release must not try to publish the same version to npm again, or `npm publish` will fail.

### Rerunning a failed **Release** workflow

`Release` is triggered by **CI** via `workflow_run`. **Re-run** repeats the same triggering event’s checkout (an older SHA). If you already fixed `main` on GitHub, tags can match `origin/main` while the rerun still checks an old detached state and the verify step fails.

Do **not** rely on rerun for that case: push a new commit to `main` (or trigger CI again) so a **new** `workflow_run` runs against current `head_sha`. The verify script fetches `origin/main` so it judges the real branch tip, not only the job checkout.

### Prevention

- Create release tags only from commits that are on `main` (or merge the release commit into `main` before tagging).
- CI fetches tags explicitly; see `.github/workflows/release.yml`.

### Check locally

```bash
git fetch --tags --force
git tag --merged main | grep '@at-flux/'
```

Every tag you expect semantic-release to honour should appear in that list.
