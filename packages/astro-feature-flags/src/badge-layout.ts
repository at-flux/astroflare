export type ElementBadgeVerticalAnchor = "top" | "bottom";

/** Horizontal placement of the element pill: `end` = top-right (LTR), `start` = top-left, `center` = centred. */
export type ElementBadgeHorizontalAlign = "start" | "center" | "end";

/** Subset of dev CSS options used for element-badge geometry (also on `DevOutlineCssOptions`). */
export interface ElementBadgeLayoutOptions {
  /**
   * Horizontal alignment along the host’s top or bottom edge. Default `end` (top-right in LTR).
   * Ignored when `elementBadgeHorizontalPercent` is set.
   */
  elementBadgeHorizontalAlign?: ElementBadgeHorizontalAlign;
  /**
   * Optional: anchor at a percentage along the host width (0–100), with the pill centred on that point (`translateX(-50%)`).
   * When set, overrides `elementBadgeHorizontalAlign`.
   */
  elementBadgeHorizontalPercent?: number;
  /**
   * Vertical shift as a percentage of the **badge’s own height** (CSS transform %).
   * With anchor `top`, moves the badge upward. Default `80` (~20% of the pill overlaps the host top edge).
   */
  elementBadgeVerticalShiftPercent?: number;
  /** Anchor the badge to the top or bottom edge of the host. Default `top`. */
  elementBadgeVerticalAnchor?: ElementBadgeVerticalAnchor;
}

export type NormalizedElementBadgeLayout =
  | {
      mode: "align";
      horizontalAlign: ElementBadgeHorizontalAlign;
      verticalShiftPercent: number;
      verticalAnchor: ElementBadgeVerticalAnchor;
    }
  | {
      mode: "percent";
      horizontalPercent: number;
      verticalShiftPercent: number;
      verticalAnchor: ElementBadgeVerticalAnchor;
    };

function clampPercent(n: number, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export function normalizeElementBadgeLayout(
  input: ElementBadgeLayoutOptions | undefined,
): NormalizedElementBadgeLayout {
  const v = clampPercent(input?.elementBadgeVerticalShiftPercent ?? 80, 80);
  const anchor =
    input?.elementBadgeVerticalAnchor === "bottom" ? "bottom" : "top";
  const hp = input?.elementBadgeHorizontalPercent;
  if (hp !== undefined && hp !== null && typeof hp === "number") {
    return {
      mode: "percent",
      horizontalPercent: clampPercent(hp, 50),
      verticalShiftPercent: v,
      verticalAnchor: anchor,
    };
  }
  const align: ElementBadgeHorizontalAlign =
    input?.elementBadgeHorizontalAlign === "start" ||
    input?.elementBadgeHorizontalAlign === "center"
      ? input.elementBadgeHorizontalAlign
      : "end";
  return {
    mode: "align",
    horizontalAlign: align,
    verticalShiftPercent: v,
    verticalAnchor: anchor,
  };
}

const INSET = "0.35rem";

/**
 * `left` / `right` / `top` | `bottom` / `transform` for the element `::before` badge (no trailing newline).
 */
export function elementBadgePositionBlock(
  layout: NormalizedElementBadgeLayout,
): string {
  const { verticalShiftPercent: v, verticalAnchor } = layout;
  const y =
    verticalAnchor === "top"
      ? `translateY(calc(-1 * ${v}%))`
      : `translateY(${v}%)`;

  if (layout.mode === "percent") {
    const h = layout.horizontalPercent;
    if (verticalAnchor === "top") {
      return `  left: ${h}%;
  right: auto;
  top: 0;
  bottom: auto;
  transform: translateX(-50%) ${y};`;
    }
    return `  left: ${h}%;
  right: auto;
  bottom: 0;
  top: auto;
  transform: translateX(-50%) ${y};`;
  }

  const { horizontalAlign } = layout;
  if (horizontalAlign === "center") {
    if (verticalAnchor === "top") {
      return `  left: 50%;
  right: auto;
  top: 0;
  bottom: auto;
  transform: translateX(-50%) ${y};`;
    }
    return `  left: 50%;
  right: auto;
  bottom: 0;
  top: auto;
  transform: translateX(-50%) ${y};`;
  }
  if (horizontalAlign === "start") {
    if (verticalAnchor === "top") {
      return `  left: ${INSET};
  right: auto;
  top: 0;
  bottom: auto;
  transform: ${y};`;
    }
    return `  left: ${INSET};
  right: auto;
  bottom: 0;
  top: auto;
  transform: ${y};`;
  }
  /* end — top-right / bottom-right */
  if (verticalAnchor === "top") {
    return `  left: auto;
  right: ${INSET};
  top: 0;
  bottom: auto;
  transform: ${y};`;
  }
  return `  left: auto;
  right: ${INSET};
  bottom: 0;
  top: auto;
  transform: ${y};`;
}
