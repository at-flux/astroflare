/**
 * Framework-agnostic core for the {@link ShareLinks} component: builds the
 * share-intent URLs, resolves per-network metadata (label + icon key), and
 * preserves the caller-given order. Kept as plain TS so it is unit-testable
 * without rendering the Astro component.
 */

/** Networks the component knows how to render an icon + intent for. */
export type ShareNetwork =
  "bluesky" | "facebook" | "x" | "linkedin" | "instagram" | "copy";

/** One entry the caller passes to `ShareLinks`. */
export interface ShareLinkInput {
  /** Which network this entry is for. */
  network: ShareNetwork;
  /**
   * Explicit href. Overrides the built intent URL — required for networks with
   * no share-by-URL intent (e.g. `instagram`, where you'd pass a profile link).
   */
  href?: string;
  /** Accessible label / tooltip override (defaults per network). */
  label?: string;
}

/** Shared page context used to build intent URLs when no `href` is given. */
export interface ShareContext {
  /** Absolute URL of the page being shared. */
  url: string;
  /** Optional title / message included where the network supports it. */
  text?: string;
}

/** A resolved, render-ready entry (order preserved from the input). */
export interface ResolvedShareLink {
  network: ShareNetwork;
  /** `copy` renders a clipboard button; `link` renders an anchor. */
  kind: "link" | "copy";
  /** Present for `link`; absent for `copy`. */
  href?: string;
  /** Accessible label + tooltip text. */
  label: string;
}

/** Default accessible labels per network. */
export const SHARE_LABELS: Record<ShareNetwork, string> = {
  bluesky: "Share on Bluesky",
  facebook: "Share on Facebook",
  x: "Share on X",
  linkedin: "Share on LinkedIn",
  instagram: "Instagram",
  copy: "Copy link",
};

/**
 * Build the share-intent URL for `network` from the page `url` / `text`.
 * Returns `null` for networks with no share-by-URL intent (`instagram`) and for
 * `copy` (which is a clipboard action, not a link).
 */
export function buildShareHref(
  network: ShareNetwork,
  { url, text = "" }: ShareContext,
): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  switch (network) {
    case "bluesky":
      // Compose intent: text then the URL (Bluesky has no dedicated url field).
      return `https://bsky.app/intent/compose?text=${t}%20${u}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "instagram":
    case "copy":
      return null;
  }
}

/**
 * Resolve caller inputs into render-ready entries, preserving order. Link
 * entries with no explicit href and no buildable intent (e.g. `instagram`
 * without a profile `href`) are dropped so nothing renders as a dead link.
 */
export function resolveShareLinks(
  inputs: ShareLinkInput[],
  ctx: ShareContext,
): ResolvedShareLink[] {
  const resolved: ResolvedShareLink[] = [];
  const seen = new Set<ShareNetwork>();
  for (const input of inputs) {
    if (seen.has(input.network)) continue; // a network renders once; first wins
    seen.add(input.network);
    const label = input.label ?? SHARE_LABELS[input.network];
    if (input.network === "copy") {
      resolved.push({ network: "copy", kind: "copy", label });
      continue;
    }
    const href = input.href ?? buildShareHref(input.network, ctx) ?? undefined;
    if (!href) continue; // unsupported network with no explicit href → skip
    resolved.push({ network: input.network, kind: "link", href, label });
  }
  return resolved;
}
