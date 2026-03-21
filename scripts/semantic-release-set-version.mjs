#!/usr/bin/env node
/**
 * Bump package.json "version" without `npm version` (avoids npm 11 + pnpm workspace bugs in CI).
 * Invoked from each package directory by @semantic-release/exec prepareCmd.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('semantic-release-set-version: missing version argument');
  process.exit(1);
}

const pkgPath = resolve(process.cwd(), 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Set ${pkg.name} version to ${version}`);
