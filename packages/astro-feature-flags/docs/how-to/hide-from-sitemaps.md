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
  root: process.cwd(),
  flags: {
    dev: { colour: "rgb(220 38 38)", routes: ["/blog/*"] },
  },
  environments: {
    dev: { when: process.env.NODE_ENV !== "production", flags: { dev: true } },
    prod: {
      when: process.env.NODE_ENV === "production",
      flags: { dev: false },
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
