// @ts-check
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import astroFeatureFlags from "@at-flux/astro-feature-flags";

export default defineConfig({
  trailingSlash: "always",
  integrations: [
    astroFeatureFlags({
      configRoot: fileURLToPath(new URL(".", import.meta.url)),
      jsonConfigPath: "ff.json",
      // Reserved `dev` is injected. Optional per-layer JSON: `environments.<name>.jsonConfigPath`.
      // Exactly one `when: true` for the selected environment unless you pin with forceEnvironment / AFF_ENVIRONMENT.
      environments: {
        prod: {
          when: process.env.NODE_ENV === "production",
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
