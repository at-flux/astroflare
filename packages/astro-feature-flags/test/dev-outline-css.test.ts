import type { ResolvedFeatureRuntime } from "../src/runtime";
import { describe, expect, it } from "vitest";
import { createFeatureFlagStyles } from "../src/dev-outline-css";

const bare = (
  r: Omit<
    ResolvedFeatureRuntime,
    | "flagColorsByToken"
    | "flagOutlineDefaultsByToken"
    | "flagBadgeDefaultsByToken"
    | "activeEnvironment"
  > &
    Partial<
      Pick<
        ResolvedFeatureRuntime,
        | "flagColorsByToken"
        | "flagOutlineDefaultsByToken"
        | "flagBadgeDefaultsByToken"
      >
    >,
): ResolvedFeatureRuntime => {
  const activeEnvironment =
    (r as { activeEnvironment?: string }).activeEnvironment ??
    (r.isDev ? "dev" : "prod");
  return {
    flagColorsByToken: {},
    flagOutlineDefaultsByToken: {},
    flagBadgeDefaultsByToken: {},
    ...r,
    activeEnvironment,
    isDev: r.isDev ?? activeEnvironment === "dev",
  };
};

describe("dev-outline-css snapshots", () => {
  it("matches stable output for a minimal two-flag runtime", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "snap",
        mode: "development",
        isDev: true,
        flags: { wip: true, beta: false },
        routeFlags: {},
        flagColorsByToken: { wip: "#ff0000", beta: "#0000ff" },
      }),
      { outlineOffset: "-2px", badgeLabelWip: "wip" },
    );
    expect(css).toMatchSnapshot();
  });
});

/**
 * Marking an element with `data-ff` must not move it. The badge needs its host to
 * be a containing block, but an app that positions the element itself has to win,
 * which is why those two declarations are wrapped in `:where()` and put in the
 * `aff-dev` cascade layer. `:where()` alone loses the argument: an unlayered rule
 * beats a layered one whatever its specificity, so a zero-specificity unlayered
 * rule still overrides Tailwind's `.absolute` and `.rounded-full` in
 * `@layer utilities`.
 */
describe("dev-outline-css does not fight the app's own layout", () => {
  const css = () =>
    createFeatureFlagStyles(
      bare({
        namespace: "ff",
        mode: "development",
        isDev: true,
        flags: { sept: true },
        routeFlags: {},
      }),
    );

  /** The declaration block that follows a selector, for the first match. */
  const blockAfter = (sheet: string, selector: string): string | null => {
    const at = sheet.indexOf(selector + " {");
    if (at === -1) return null;
    const open = sheet.indexOf("{", at);
    const close = sheet.indexOf("}", open);
    return sheet.slice(open + 1, close);
  };

  it("gives the host `position` no specificity of its own", () => {
    const sheet = css();
    const zeroSpecificity = sheet.match(/:where\([\s\S]*?\) \{[^}]*\}/g) ?? [];

    expect(
      zeroSpecificity.some((rule) => rule.includes("position: relative")),
    ).toBe(true);
  });

  it("never sets `position` at a specificity an app utility cannot beat", () => {
    const sheet = css();
    // Strip every `:where(…)` rule, then nothing left may position the host.
    const outsideWhere = sheet.replace(/:where\([\s\S]*?\) \{[^}]*\}/g, "");

    expect(outsideWhere).not.toContain("position: relative");
  });

  it("declares the dev layer before it uses it", () => {
    const sheet = css();
    const declared = sheet.indexOf("@layer aff-dev;");
    const used = sheet.indexOf("@layer aff-dev {");

    expect(declared).toBe(sheet.indexOf("@layer aff-dev"));
    expect(declared).toBeGreaterThanOrEqual(0);
    expect(used).toBeGreaterThan(declared);
  });

  it("puts the host declarations in the dev layer, not outside every layer", () => {
    const sheet = css();
    // Every rule that positions or rounds the host sits inside `@layer aff-dev {`.
    const layered = sheet.match(/@layer aff-dev \{[\s\S]*?\n\}/g) ?? [];
    const outsideLayers = sheet.replace(/@layer aff-dev \{[\s\S]*?\n\}/g, "");

    expect(layered.some((rule) => rule.includes("position: relative"))).toBe(
      true,
    );
    expect(outsideLayers).not.toContain("position: relative");
  });

  it("still draws the outline at its natural specificity", () => {
    const sheet = css();
    const block = blockAfter(
      sheet,
      '[data-ff~="sept"]:not([data-ff*=" "]), [data-ff-sept]:not([data-ff*=" "])',
    );

    expect(block).toContain("outline: 2px solid");
    // Both belong to the app, and both moved into the `:where()` rule above.
    expect(block).not.toContain("position:");
    expect(block).not.toContain("border-radius:");
  });

  it("applies the same treatment to a combo host", () => {
    const sheet = css();
    const block = blockAfter(sheet, '[data-ff*=" "]');

    expect(block).toContain("outline: none !important");
    expect(block).not.toContain("position:");
    expect(block).not.toContain("border-radius:");
    expect(sheet).toContain(':where([data-ff*=" "]) {');
  });
});
