import { defineConfig } from "tsdown";

/**
 * Rolldown-based library build (tsdown). Astro and deep `astro/*` imports stay external;
 * Node built-ins resolve via `platform: 'node'`.
 */
export default defineConfig({
  entry: ["src/index.ts", "src/runtime.ts", "src/dev-toolbar-app.ts"],
  format: "esm",
  dts: true,
  platform: "node",
  deps: {
    neverBundle: ["astro", /^astro\//],
  },
});
