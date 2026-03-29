#!/usr/bin/env node
/**
 * Fail CI if any @at-flux/*@* release tag exists but is not an ancestor of the release branch.
 * That situation makes multi-semantic-release think there is no last release while `git tag` still
 * refuses to recreate the same tag name.
 */
import { execSync } from 'node:child_process';

const branch = process.env.RELEASE_BRANCH || 'main';

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function tagReachableFromBranch(tag) {
  try {
    execSync(`git merge-base --is-ancestor "${tag}" "${branch}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const tags = sh('git tag -l')
  .split('\n')
  .map((t) => t.trim())
  .filter(Boolean)
  .filter((t) => /^@at-flux\/[^@]+@\d+\.\d+\.\d+/.test(t));

const bad = tags.filter((t) => !tagReachableFromBranch(t));

if (bad.length === 0) {
  console.log(`verify-release-tags-on-main: all ${tags.length} scoped release tag(s) are ancestors of ${branch}.`);
  process.exit(0);
}

console.error(
  `verify-release-tags-on-main: ${bad.length} tag(s) exist but are not ancestors of "${branch}" (semantic-release uses git tag --merged):`,
);
for (const t of bad) {
  console.error(`  - ${t}`);
}
console.error('\nSee docs/RELEASE-TROUBLESHOOTING.md');
process.exit(1);
