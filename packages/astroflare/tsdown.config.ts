import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/forms/index.ts", "src/core.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  /** Match prior tsup output: `index.js` / `index.cjs` (not `.mjs`). */
  fixedExtension: false,
  platform: "node",
});
