import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Resolved through the package's own export map (a self-reference), the way a
// consumer's bundler or `tsc` sees it. Export targets get no extension search,
// so a subpath written without `.ts` must map to a file that has one.
const require = createRequire(import.meta.url);

describe("package exports", () => {
  it.each([
    "@at-flux/astroflare/runtime/collection-query",
    "@at-flux/astroflare/runtime/collection-query.ts",
  ])("should resolve %s to the runtime source", (specifier) => {
    expect(require.resolve(specifier)).toMatch(
      /src[\\/]runtime[\\/]collection-query\.ts$/,
    );
  });
});
