import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const exampleDir = join(root, 'example');

describe('production build output gating', () => {
  it('prunes disabled routes and excludes SSR-gated content', () => {
    execSync('pnpm --dir example install --ignore-workspace && pnpm --dir example build', {
      cwd: root,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'pipe',
    });

    const distHot = join(exampleDir, 'dist', 'hot');
    const indexHtmlPath = join(exampleDir, 'dist', 'index.html');
    const indexHtml = readFileSync(indexHtmlPath, 'utf8');

    expect(existsSync(distHot)).toBe(false);
    expect(indexHtml).not.toContain('This line is visible because');
  });
});
