# Release troubleshooting (multi-semantic-release)

## `fatal: tag '@at-flux/astroflare@x.y.z' already exists`

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
   git tag -f '@at-flux/astroflare@1.0.0' origin/main
   git push origin 'refs/tags/@at-flux/astroflare@1.0.0' --force
   ```

   Replace the package name and version in the tag to match your case.

2. **Delete the orphan tag** (only if you are sure it should not exist and npm state matches your plan):

   ```bash
   git push origin ':refs/tags/@at-flux/astroflare@1.0.0'
   ```

   After deletion, the **next** release must not try to publish the same version to npm again, or `npm publish` will fail.

### Prevention

- Create release tags only from commits that are on `main` (or merge the release commit into `main` before tagging).
- CI fetches tags explicitly; see `.github/workflows/release.yml`.

### Check locally

```bash
git fetch --tags --force
git tag --merged main | grep '@at-flux/'
```

Every tag you expect semantic-release to honour should appear in that list.
