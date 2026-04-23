interface MediaProtectState {
  drag: boolean;
  contextMenu: boolean;
}

declare global {
  interface Window {
    __astroflareMediaProtectHandlerState__?: MediaProtectState;
  }
}

const STATE_KEY = "__astroflareMediaProtectHandlerState__";

const shouldPrevent = (target: EventTarget | null, mode: "drag" | "contextMenu"): boolean => {
  if (!(target instanceof Element)) return false;
  const root = target.closest<HTMLElement>("[data-media-protect-root]");
  if (!root) return false;
  return mode === "drag"
    ? root.dataset.mediaProtectDrag === "true"
    : root.dataset.mediaProtectContextMenu === "true";
};

const ensureHandlers = (options: { drag: boolean; contextMenu: boolean }) => {
  const runtime = window;
  const state = runtime[STATE_KEY] ?? { drag: false, contextMenu: false };
  runtime[STATE_KEY] = state;

  if (options.contextMenu && !state.contextMenu) {
    document.addEventListener(
      "contextmenu",
      (event) => {
        if (shouldPrevent(event.target, "contextMenu")) event.preventDefault();
      },
      { capture: true },
    );
    state.contextMenu = true;
  }

  if (options.drag && !state.drag) {
    document.addEventListener(
      "dragstart",
      (event) => {
        if (shouldPrevent(event.target, "drag")) event.preventDefault();
      },
      { capture: true },
    );
    state.drag = true;
  }
};

export const initMediaProtectRoots = (scope: ParentNode = document): void => {
  const roots = Array.from(
    scope.querySelectorAll<HTMLElement>(
      "[data-media-protect-root]:not([data-media-protect-init='true'])",
    ),
  );
  if (roots.length === 0) return;

  let dragNeeded = false;
  let contextMenuNeeded = false;

  roots.forEach((root) => {
    root.dataset.mediaProtectInit = "true";
    dragNeeded = dragNeeded || root.dataset.mediaProtectDrag === "true";
    contextMenuNeeded =
      contextMenuNeeded || root.dataset.mediaProtectContextMenu === "true";
  });

  ensureHandlers({ drag: dragNeeded, contextMenu: contextMenuNeeded });
};
