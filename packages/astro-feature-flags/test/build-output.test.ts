import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const exampleDir = join(root, "example");
const ssrFixtureDir = join(root, "test", "fixtures", "ssr-gate-site");
const runSlowTests = process.env.ENABLE_SLOW === "1";

describe("production build output gating", () => {
  const slowIt = runSlowTests ? it : it.skip;

  slowIt(
    "prunes disabled routes from the example app",
    () => {
      execSync("pnpm --dir example build", {
        cwd: root,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: "pipe",
      });

      const distHot = join(exampleDir, "dist", "hot");
      expect(existsSync(distHot)).toBe(false);
    },
    20000,
  );

  slowIt(
    "production fixture: shouldRenderFeature omits markup; data-ff nodes culled; no gate CSS",
    () => {
      execSync("pnpm install --ignore-workspace", {
        cwd: ssrFixtureDir,
        env: { ...process.env, NODE_ENV: "development" },
        stdio: "pipe",
      });
      execSync("pnpm build", {
        cwd: ssrFixtureDir,
        env: { ...process.env, NODE_ENV: "production" },
        stdio: "pipe",
      });

      const indexHtmlPath = join(ssrFixtureDir, "dist", "index.html");
      const indexHtml = readFileSync(indexHtmlPath, "utf8");

      // Compile-time API: branch is false → no node, no marker text.
      expect(indexHtml).not.toContain("AFF_SSR_GATE_HOT_FEATURE_2");

      // Declarative data-ff: gated nodes removed from static HTML (no display:none gate CSS).
      expect(indexHtml).not.toContain("AFF_DATA_FF_GATE_HOT_FEATURE_2");
      expect(indexHtml).not.toContain("data-ff-hot-feature-2");
      expect(indexHtml).not.toContain("display: none !important");
      expect(indexHtml).not.toMatch(/<style[^>]*>\s*<\/style>/);
    },
    120000,
  );
});
