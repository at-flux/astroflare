import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isRouteFlagged,
  loadFeatureConfig,
  longestMatchingRoutePrefix,
  resolveFeatureRuntime,
  routePatternToPrefix,
  routePathsToPrune,
  shouldIncludeRoute,
  shouldRenderFeatureInMode,
  toEnumKey,
  toToken,
} from '../src/runtime';

describe('naming', () => {
  it('creates enum-safe names', () => {
    expect(toEnumKey('shinyNewFeature')).toBe('ShinyNewFeature');
    expect(toEnumKey('dev-mode')).toBe('DevMode');
    expect(toEnumKey('foo_bar')).toBe('FooBar');
  });

  it('creates CSS/env tokens', () => {
    expect(toToken('shinyNewFeature')).toBe('shiny-new-feature');
    expect(toToken('dev mode')).toBe('dev-mode');
  });
});

describe('class token conventions', () => {
  it('builds per-flag class names without double dashes', () => {
    const namespace = 'demo-feat';
    const token = toToken('shinyNewFeature');
    expect(`${namespace}-${token}`).toBe('demo-feat-shiny-new-feature');
    expect(`${namespace}-${toToken('dev')}`).toBe('demo-feat-dev');
  });
});

describe('css token label mapping', () => {
  it('uses toToken for tokens', () => {
    expect(toToken('ShinyNewFeature')).toBe('shiny-new-feature');
    expect(toToken('dev')).toBe('dev');
  });
});

describe('routePatternToPrefix', () => {
  it('maps wildcards to directory prefixes', () => {
    expect(routePatternToPrefix('/blog/*')).toBe('/blog/');
    expect(routePatternToPrefix('/blog/**')).toBe('/blog/');
    expect(routePatternToPrefix('/docs')).toBe('/docs/');
  });
});

describe('longestMatchingRoutePrefix', () => {
  const routeFlags = {
    '/blog/': 'dev',
    '/': 'root',
  };

  it('returns longest matching route flag prefix', () => {
    expect(longestMatchingRoutePrefix('/blog/hello/', routeFlags)).toBe('/blog/');
    expect(longestMatchingRoutePrefix('/blog/', routeFlags)).toBe('/blog/');
    expect(longestMatchingRoutePrefix('/about/', routeFlags)).toBe('/');
  });

  it('matches ff.json /blog/* style keys', () => {
    expect(longestMatchingRoutePrefix('/blog/post/', { '/blog/*': 'dev' })).toBe('/blog/*');
    expect(longestMatchingRoutePrefix('/blog/', { '/blog/*': 'dev' })).toBe('/blog/*');
  });

  it('returns null when nothing matches', () => {
    expect(longestMatchingRoutePrefix('/labs/foo/', { '/blog/': 'dev' })).toBe(null);
  });
});

describe('config loading', () => {
  it('loads defaults when no files exist', () => {
    const config = loadFeatureConfig({
      root: '/tmp/aff-does-not-exist-9f3a2',
      mode: 'production',
      baseName: 'missing-ff',
    });
    expect(config.namespace).toBe('ff');
    expect(config.flags.dev).toBe(true);
    expect(config.colors.dev).toBe('rgb(220 38 38)');
  });

  it('merges ff.prod.json over ff.json in production mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aff-ff-'));
    try {
      writeFileSync(
        join(dir, 'ff.json'),
        JSON.stringify({
          ns: 'demo',
          flags: { dev: true, hotFeature2: false },
          routes: { '/labs/': 'hotFeature2' },
          colors: { dev: 'red', hotFeature2: 'blue' },
        })
      );
      writeFileSync(join(dir, 'ff.prod.json'), JSON.stringify({ flags: { dev: false, hotFeature2: true } }));

      const cfg = loadFeatureConfig({ root: dir, mode: 'production', baseName: 'ff' });
      expect(cfg.namespace).toBe('demo');
      expect(cfg.flags.dev).toBe(false);
      expect(cfg.flags.hotFeature2).toBe(true);
      expect(cfg.routeFlags['/labs/']).toBe('hotFeature2');
      expect(cfg.colors.dev).toBe('red');
      expect(cfg.colors.hotFeature2).toBe('blue');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not read ff.prod.json in development mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aff-ff-dev-'));
    try {
      writeFileSync(join(dir, 'ff.json'), JSON.stringify({ flags: { dev: true } }));
      writeFileSync(join(dir, 'ff.prod.json'), JSON.stringify({ flags: { dev: false } }));

      const cfg = loadFeatureConfig({ root: dir, mode: 'development', baseName: 'ff' });
      expect(cfg.flags.dev).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('merges ff.{env}.json after ff.json when ffEnv is set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aff-ff-env-'));
    try {
      writeFileSync(
        join(dir, 'ff.json'),
        JSON.stringify({ flags: { dev: true, beta: false }, routes: { '/': 'dev' } })
      );
      writeFileSync(join(dir, 'ff.preview.json'), JSON.stringify({ flags: { beta: true } }));

      const cfg = loadFeatureConfig({ root: dir, mode: 'development', baseName: 'ff', ffEnv: 'preview' });
      expect(cfg.flags.dev).toBe(true);
      expect(cfg.flags.beta).toBe(true);
      expect(cfg.routeFlags['/']).toBe('dev');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('route behavior', () => {
  const routeFlags = { '/blog/': 'dev', '/labs/': 'labs' };
  const flags = { dev: false, labs: true };

  it('matches flagged routes including descendants', () => {
    expect(isRouteFlagged('/blog/', routeFlags)).toBe(true);
    expect(isRouteFlagged('/blog/hello/', routeFlags)).toBe(true);
    expect(isRouteFlagged('/about/', routeFlags)).toBe(false);
  });

  it('includes everything in dev mode', () => {
    expect(
      shouldIncludeRoute({
        pathname: '/blog/hello/',
        routeFlags,
        flags,
        isDev: true,
      })
    ).toBe(true);
  });

  it('omits disabled flagged routes in production', () => {
    expect(
      shouldIncludeRoute({
        pathname: '/blog/hello/',
        routeFlags,
        flags,
        isDev: false,
      })
    ).toBe(false);
  });

  it('keeps enabled flagged routes in production', () => {
    expect(
      shouldIncludeRoute({
        pathname: '/labs/abc/',
        routeFlags,
        flags,
        isDev: false,
      })
    ).toBe(true);
  });
});

describe('render behavior', () => {
  it('always renders in dev mode', () => {
    expect(
      shouldRenderFeatureInMode({
        isDev: true,
        flags: { dev: false },
        flag: 'dev',
      })
    ).toBe(true);
  });

  it('obeys feature flags in production mode', () => {
    expect(
      shouldRenderFeatureInMode({
        isDev: false,
        flags: { dev: false },
        flag: 'dev',
      })
    ).toBe(false);
    expect(
      shouldRenderFeatureInMode({
        isDev: false,
        flags: { dev: true },
        flag: 'dev',
      })
    ).toBe(true);
  });
});

describe('env overrides and pruning', () => {
  it('supports AFF_FEATURE_* env overrides', () => {
    const runtime = resolveFeatureRuntime({
      mode: 'production',
      isDev: false,
      env: {
        AFF_FEATURE_DEV: 'true',
        AFF_FEATURE_SHINY_NEW_FEATURE: '1',
      },
      defaults: {
        namespace: 'site-ff',
        flags: { dev: false, shinyNewFeature: false },
        routeFlags: { '/blog/': 'dev' },
      },
    });
    expect(runtime.flags.dev).toBe(true);
    expect(runtime.flags.shinyNewFeature).toBe(true);
  });

  it('returns only disabled route paths for pruning', () => {
    expect(
      routePathsToPrune({
        routeFlags: { '/blog/': 'dev', '/labs/': 'labs' },
        flags: { dev: false, labs: true },
      })
    ).toEqual(['blog']);
  });
});
