import { describe, expect, it } from "vitest";
import { cullProductionHtml } from "../src/production-html-cull";
import type { ResolvedFeatureRuntime } from "../src/runtime";
import { createVirtualModuleSource } from "../src/index";

const bare = (
  r: Omit<
    ResolvedFeatureRuntime,
    | "flagColorsByToken"
    | "flagOutlineDefaultsByToken"
    | "flagBadgeDefaultsByToken"
  > &
    Partial<
      Pick<
        ResolvedFeatureRuntime,
        | "flagColorsByToken"
        | "flagOutlineDefaultsByToken"
        | "flagBadgeDefaultsByToken"
      >
    >,
): ResolvedFeatureRuntime => ({
  flagColorsByToken: {},
  flagOutlineDefaultsByToken: {},
  flagBadgeDefaultsByToken: {},
  ...r,
});

describe("cullProductionHtml", () => {
  it("removes elements gated by a disabled flag (shorthand attribute)", () => {
    const html = `<!DOCTYPE html><html><body>
      <p data-ff-hot-feature-2 id="x">REMOVE_ME</p>
      <p id="keep">stay</p>
    </body></html>`;
    const out = cullProductionHtml(
      html,
      bare({
        namespace: "ff",
        mode: "production",
        isDev: false,
        flags: { hotFeature2: false },
        routeFlags: {},
      }),
    );
    expect(out).not.toContain("REMOVE_ME");
    expect(out).not.toContain("data-ff-hot-feature-2");
    expect(out).toContain("stay");
  });

  it("removes elements when any token in data-ff value is disabled (combinatory)", () => {
    const html = `<!DOCTYPE html><html><body>
      <p data-ff="dev hot-feature-2">combo</p>
    </body></html>`;
    const out = cullProductionHtml(
      html,
      bare({
        namespace: "ff",
        mode: "production",
        isDev: false,
        flags: { dev: true, hotFeature2: false },
        routeFlags: {},
      }),
    );
    expect(out).not.toContain("combo");
  });

  it("strips data-ff-route from html and removes empty style tags", () => {
    const html = `<!DOCTYPE html><html data-ff-route="hot-feature-2" data-ff-route-label="x"><head>
      <style></style>
      <style> </style>
    </head><body><p>ok</p></body></html>`;
    const out = cullProductionHtml(
      html,
      bare({
        namespace: "ff",
        mode: "production",
        isDev: false,
        flags: { hotFeature2: true },
        routeFlags: {},
      }),
    );
    expect(out).not.toContain("data-ff-route");
    expect(out).not.toContain("data-ff-route-label");
    expect(out).not.toMatch(/<style[^>]*>\s*<\/style>/);
    expect(out).toContain("ok");
  });

  it("virtual module uses empty featureFlagStyles in production", () => {
    const src = createVirtualModuleSource(
      bare({
        namespace: "ff",
        mode: "production",
        isDev: false,
        flags: { dev: false },
        routeFlags: {},
      }),
      undefined,
      { dev: false },
    );
    expect(src).toContain(
      "export const featureFlagStyles = import.meta.env.DEV ? ",
    );
    expect(src).toMatch(
      /export const featureFlagStyles = import\.meta\.env\.DEV \? [\s\S]+ : "";/,
    );
  });
});
