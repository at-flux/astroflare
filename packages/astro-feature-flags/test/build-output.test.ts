import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const exampleDir = join(root, "example");
const runSlowTests = process.env.ENABLE_SLOW === "1";

describe("production build output gating", () => {
  const slowIt = runSlowTests ? it : it.skip;
  slowIt(
    "prunes disabled routes and excludes SSR-gated content",
    () => {
      execSync("pnpm --dir example build", {
        cwd: root,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: "pipe",
      });

      const distHot = join(exampleDir, "dist", "hot");
      const indexHtmlPath = join(exampleDir, "dist", "index.html");
      const indexHtml = readFileSync(indexHtmlPath, "utf8");

      expect(existsSync(distHot)).toBe(false);
      // hotFeature2 is off in prod (ff.json): gated markup must not be emitted
      expect(indexHtml).not.toContain(
        "AFF_SLOW_BUILD_ASSERT_HOT_FEATURE_2_IN_HTML",
      );
    },
    20000,
  );
});
