#!/usr/bin/env node
/**
 * Overlay @at-flux/astroflare in node_modules with a symlink to a local checkout.
 * Does not change package.json or the lockfile — run `pnpm install` first so the
 * registry version is recorded, then this replaces only the on-disk resolution.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';

const MARKER = '.astroflare-local-overlay.json';

function findProjectRoot(start = process.cwd()) {
  let dir = resolve(start);
  for (;;) {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['@at-flux/astroflare']) {
          return dir;
        }
      } catch {
        /* continue */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      console.error('astroflare-link-local: could not find a package.json that depends on @at-flux/astroflare');
      process.exit(1);
    }
    dir = parent;
  }
}

function markerPath(projectRoot) {
  return join(projectRoot, 'node_modules', MARKER);
}

function nmTarget(projectRoot) {
  return join(projectRoot, 'node_modules', '@at-flux', 'astroflare');
}

function resolveLocalPath(projectRoot, raw) {
  if (!raw || typeof raw !== 'string') {
    console.error(
      'astroflare-link-local: pass a path to packages/astroflare, or set ASTROFLARE_LOCAL_PATH or USE_LOCAL_ASTROFLARE_PATH',
    );
    process.exit(1);
  }
  const abs = isAbsolute(raw) ? raw : resolve(projectRoot, raw);
  const pkgJson = join(abs, 'package.json');
  if (!existsSync(pkgJson)) {
    console.error(`astroflare-link-local: not a package directory (missing package.json): ${abs}`);
    process.exit(1);
  }
  try {
    const { name } = JSON.parse(readFileSync(pkgJson, 'utf8'));
    if (name !== '@at-flux/astroflare') {
      console.error(`astroflare-link-local: expected name @at-flux/astroflare, got ${name}`);
      process.exit(1);
    }
  } catch (e) {
    console.error('astroflare-link-local: could not read local package.json', e);
    process.exit(1);
  }
  return abs;
}

function symlinkType() {
  return platform() === 'win32' ? 'junction' : 'dir';
}

function cmdLink(projectRoot, localAbs) {
  const target = nmTarget(projectRoot);
  const fluxScope = dirname(target);

  rmSync(target, { recursive: true, force: true });
  mkdirSync(fluxScope, { recursive: true });
  symlinkSync(localAbs, target, symlinkType());

  mkdirSync(join(projectRoot, 'node_modules'), { recursive: true });
  writeFileSync(
    markerPath(projectRoot),
    `${JSON.stringify({ localPath: localAbs, linkedAt: new Date().toISOString() }, null, 2)}\n`,
  );

  console.log(`astroflare-link-local: linked\n  ${target}\n  → ${localAbs}`);
  console.log('astroflare-link-local: package.json and lockfile unchanged. Run `pnpm install` again only if you need to restore the registry copy (or use `unlink`).');
}

function cmdUnlink(projectRoot, runInstall) {
  const target = nmTarget(projectRoot);
  const marker = markerPath(projectRoot);

  rmSync(target, { recursive: true, force: true });
  rmSync(marker, { force: true });

  if (runInstall) {
    const r = spawnSync('pnpm', ['install'], { cwd: projectRoot, stdio: 'inherit', shell: true });
    if (r.error) {
      console.error('astroflare-link-local: pnpm install failed:', r.error.message);
      process.exit(r.status ?? 1);
    }
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
    console.log('astroflare-link-local: restored @at-flux/astroflare from the lockfile.');
  } else {
    console.log('astroflare-link-local: removed overlay. Run `pnpm install` to restore node_modules.');
  }
}

function cmdStatus(projectRoot) {
  const marker = markerPath(projectRoot);
  const target = nmTarget(projectRoot);
  if (!existsSync(marker)) {
    console.log('astroflare-link-local: no local overlay (registry / store layout).');
    return;
  }
  try {
    const data = JSON.parse(readFileSync(marker, 'utf8'));
    console.log('astroflare-link-local: overlay active');
    console.log(`  marker: ${marker}`);
    console.log(`  local:  ${data.localPath}`);
    if (existsSync(target)) {
      console.log(`  node_modules: ${target}`);
    }
  } catch {
    console.log('astroflare-link-local: marker present but invalid');
  }
}

function localPathFromEnv() {
  return process.env.ASTROFLARE_LOCAL_PATH || process.env.USE_LOCAL_ASTROFLARE_PATH || null;
}

function useLocalAstroflareEnv() {
  const v = process.env.USE_LOCAL_ASTROFLARE;
  return v === '1' || v === 'true' || v === 'yes';
}

const argv = process.argv.slice(2);

if (argv[0] === 'help' || argv[0] === '-h' || argv[0] === '--help') {
  console.log(`Usage:
  astroflare-link-local [link] <path-to-packages/astroflare>
  astroflare-link-local              # uses ASTROFLARE_LOCAL_PATH or USE_LOCAL_ASTROFLARE_PATH (required)
  USE_LOCAL_ASTROFLARE=1 must be paired with a path via ASTROFLARE_LOCAL_PATH or USE_LOCAL_ASTROFLARE_PATH

  astroflare-link-local unlink       # remove symlink; run pnpm install
  astroflare-link-local unlink --no-install
  astroflare-link-local status

Symlinks node_modules/@at-flux/astroflare → local checkout. Does not edit package.json or lockfile.`);
  process.exit(0);
}

const projectRoot = findProjectRoot();

if (argv[0] === 'unlink') {
  const noInstall = argv.includes('--no-install');
  cmdUnlink(projectRoot, !noInstall);
  process.exit(0);
}

if (argv[0] === 'status') {
  cmdStatus(projectRoot);
  process.exit(0);
}

let rawPath;
if (argv[0] === 'link') {
  rawPath = argv[1] ?? localPathFromEnv();
} else if (argv[0]) {
  rawPath = argv[0];
} else {
  rawPath = localPathFromEnv();
}

if (useLocalAstroflareEnv() && !rawPath) {
  console.error(
    'astroflare-link-local: USE_LOCAL_ASTROFLARE is set; also set ASTROFLARE_LOCAL_PATH or USE_LOCAL_ASTROFLARE_PATH (or pass a path).',
  );
  process.exit(1);
}

if (!rawPath) {
  console.error('astroflare-link-local: missing path. Pass <path>, or set ASTROFLARE_LOCAL_PATH / USE_LOCAL_ASTROFLARE_PATH.');
  console.error('Run: astroflare-link-local --help');
  process.exit(1);
}

const localAbs = resolveLocalPath(projectRoot, rawPath);
cmdLink(projectRoot, localAbs);
