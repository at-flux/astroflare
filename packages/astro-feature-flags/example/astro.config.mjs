// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import astroFeatureFlags from '@at-flux/astro-feature-flags';

export default defineConfig({
  trailingSlash: 'always',
  integrations: [
    astroFeatureFlags({
      root: fileURLToPath(new URL('.', import.meta.url)),
      css: {
        outlineStyle: 'dotted',
        routeFrameStyle: 'dotted',
        comboOutlineStyle: 'dotted',
      },
      environments: {
        dev: {
          when: process.env.NODE_ENV !== 'production',
        },
        prod: {
          when: process.env.NODE_ENV === 'production',
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
