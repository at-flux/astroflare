// Minimal site: production build must omit `shouldRenderFeature('hotFeature2')` markup when off.
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import astroFeatureFlags from "@at-flux/astro-feature-flags";

export default defineConfig({
  integrations: [
    astroFeatureFlags({
      configRoot: fileURLToPath(new URL(".", import.meta.url)),
      flags: {
        hotFeature2: { colour: "rgb(34 197 94)" },
      },
      environments: {
        prod: {
          when: process.env.NODE_ENV === "production",
          flags: { hotFeature2: false },
        },
      },
    }),
  ],
});
