import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/forms/index.ts', 'src/dom.ts', 'src/core.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
