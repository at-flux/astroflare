// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The component's global stylesheet, applied to bare markup. jsdom cascades
 * declared properties, which is enough to see which animations a state pauses;
 * it renders nothing, so this checks the rules, not the pixels.
 */
const source = readFileSync(
  resolve(import.meta.dirname, "../src/components/Suspense.astro"),
  "utf8",
);
const css = /<style is:global>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? "";

const mount = (state: string) => {
  document.body.innerHTML = `
    <af-suspense class="af-suspense is-skeleton ${state}">
      <div class="af-suspense__placeholder">
        <span class="spinner"></span>
      </div>
    </af-suspense>`;
  return document.querySelector<HTMLElement>(".spinner")!;
};

describe("Suspense placeholder animations", () => {
  beforeAll(() => {
    expect(css).toContain("af-suspense__placeholder");
    const style = document.createElement("style");
    style.textContent = `${css}\n.spinner { animation-name: spin; }`;
    document.head.appendChild(style);
  });

  it.each(["is-pending", "is-ready", "is-ready is-failed"])(
    "should pause them while the placeholder is hidden (%s)",
    (state) => {
      expect(getComputedStyle(mount(state)).animationPlayState).toBe("paused");
    },
  );

  it("should let them run while the placeholder is shown", () => {
    expect(
      getComputedStyle(mount("is-pending is-waiting")).animationPlayState,
    ).not.toBe("paused");
  });
});
