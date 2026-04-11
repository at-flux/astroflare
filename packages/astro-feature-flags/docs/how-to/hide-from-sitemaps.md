# Hide Flagged Routes From Sitemaps

Use `getResolvedFeatures()` plus `featureRouteIncluded()` in your sitemap filter so routes disabled by feature flags are excluded.

```js
// astro.config.mjs

import sitemap from "@astrojs/sitemap";
import astroFeatureFlags, {
  featureRouteIncluded,
  getResolvedFeatures,
} from "@at-flux/astro-feature-flags";

const featureFlagOptions = {
  flags: {
    wip: { colour: "rgb(220 38 38)", routes: ["/blog/*"] },
  },
  environments: {
    prod: {
      when: process.env.NODE_ENV === "production",
      flags: { wip: false },
    },
  },
};

const featureRuntime = getResolvedFeatures(featureFlagOptions);

export default defineConfig({
  integrations: [
    astroFeatureFlags(featureFlagOptions),
    sitemap({
      filter: (page) => {
        try {
          const pathname = new URL(page).pathname;
          return featureRouteIncluded(pathname, featureRuntime);
        } catch {
          return true;
        }
      },
    }),
  ],
});
```

`featureRuntime` only needs to be declared before the `sitemap` filter uses it.

You can still place `astroFeatureFlags(featureFlagOptions)` anywhere in `integrations`; the key is that `featureRouteIncluded(pathname, featureRuntime)` has access to the resolved runtime object.

If the sitemap plugin runs with a `mode` where the active layer is not the one you want for URL filtering, pass **`forceEnvironment`** (same as anywhere else you pin a layer), for example `getResolvedFeatures({ ...featureFlagOptions, mode: "development", forceEnvironment: "prod" })`. Behaviour is covered by **`test/sitemap-route-filter.test.ts`** in this package.
