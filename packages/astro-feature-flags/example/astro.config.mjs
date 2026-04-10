// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import astroFeatureFlags from '@at-flux/astro-feature-flags';

const root = fileURLToPath(new URL('.', import.meta.url));
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

/** Swap REPO for your GitHub Pages project slug. */
export default defineConfig({
  site: 'https://example.github.io',
  base: '/REPO/',
  trailingSlash: 'always',
  integrations: [
    astroFeatureFlags({
      root,
      mode,
      /** Merge `ff.<FF_ENV>.json` after `ff.json` when set (e.g. preview deploys). */
      ffEnv: process.env.FF_ENV,
    }),
  ],
});
