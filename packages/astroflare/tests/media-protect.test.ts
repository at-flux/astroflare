// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initMediaProtectRoots } from "../src/runtime/media-protect";

describe("media protect runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // @ts-expect-error test reset
    delete window.__astroflareMediaProtectHandlerState__;
  });

  it("registers delegated handlers once", () => {
    document.body.innerHTML = `
      <div data-media-protect-root data-media-protect-drag="true" data-media-protect-context-menu="true"></div>
      <div data-media-protect-root data-media-protect-drag="true" data-media-protect-context-menu="true"></div>
    `;

    initMediaProtectRoots();
    const firstState = window.__astroflareMediaProtectHandlerState__;
    initMediaProtectRoots();
    const secondState = window.__astroflareMediaProtectHandlerState__;

    expect(firstState?.drag).toBe(true);
    expect(firstState?.contextMenu).toBe(true);
    expect(secondState).toBe(firstState);
  });

  it("prevents contextmenu only inside protected roots", () => {
    document.body.innerHTML = `
      <div id="protected" data-media-protect-root data-media-protect-drag="false" data-media-protect-context-menu="true">
        <img id="protected-image" />
      </div>
      <div id="open">
        <img id="open-image" />
      </div>
    `;
    initMediaProtectRoots();

    const protectedEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    const openEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    document.getElementById("protected-image")?.dispatchEvent(protectedEvent);
    document.getElementById("open-image")?.dispatchEvent(openEvent);

    expect(protectedEvent.defaultPrevented).toBe(true);
    expect(openEvent.defaultPrevented).toBe(false);
  });
});
