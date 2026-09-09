# Hide Flagged Routes From Sitemaps

A route disabled by a flag is deleted from the build. If the sitemap still lists it,
every crawler that reads the sitemap is handed a 404.

## Automatic (the default)

Put `astroFeatureFlags()` **after** `sitemap()` in `integrations` and there is nothing
else to do. Astro runs `astro:build:done` in array order, so by the time the flags
integration prunes the routes the sitemap is already on disk, and it takes the dead
`<url>` entries out of it. A sitemap left with no URLs is deleted, along with its entry
in `sitemap-index.xml`.

```js
// astro.config.mjs

import sitemap from "@astrojs/sitemap";
import astroFeatureFlags from "@at-flux/astro-feature-flags";

export default defineConfig({
  integrations: [
    sitemap(),
    // after sitemap(), so the sitemap exists when the prune runs
    astroFeatureFlags({
      flags: {
        wip: { colour: "rgb(220 38 38)", routes: ["/blog/*"] },
      },
      environments: {
        prod: {
          when: process.env.NODE_ENV === "production",
          flags: { wip: false },
        },
      },
    }),
  ],
});
```

Get the order wrong and the build warns: the sitemap is written after the prune, so
nothing is found to prune. Pass `pruneSitemap: false` to opt out, and
`staticMinify: false` to turn off route pruning and the HTML cull with it.

Matching is by route prefix, the same decision that deletes the files, so `/blog/*`
takes out `/blog/post/` and leaves `/blogroll/` alone.

## By hand

Filter in `@astrojs/sitemap` instead when the URL list needs to differ from what is
built — a route that ships but should not be advertised, say. `getResolvedFeatures()`
resolves the flags once and `featureRouteIncluded()` answers per URL:

```js
import astroFeatureFlags, {
  featureRouteIncluded,
  getResolvedFeatures,
} from "@at-flux/astro-feature-flags";

const featureFlagOptions = {
  flags: { wip: { routes: ["/blog/*"] } },
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
    sitemap({
      filter: (page) => {
        try {
          return featureRouteIncluded(new URL(page).pathname, featureRuntime);
        } catch {
          return true;
        }
      },
    }),
    astroFeatureFlags(featureFlagOptions),
  ],
});
```

`featureRuntime` only needs to be declared before the `sitemap` filter uses it. Both
mechanisms can run together: the filter never emits the URL, and the prune then finds
nothing to remove.

If the sitemap runs under a `mode` whose active layer is not the one you want for URL
filtering, pass **`forceEnvironment`** (it wins over **`AFF_ENVIRONMENT`** when both are
set), for example
`getResolvedFeatures({ ...featureFlagOptions, mode: "development", forceEnvironment: "prod" })`.

Covered by **`test/sitemap-prune.test.ts`** and **`test/sitemap-route-filter.test.ts`**.
