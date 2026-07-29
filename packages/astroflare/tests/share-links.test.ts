import { describe, it, expect } from "vitest";
import {
  buildShareHref,
  resolveShareLinks,
  SHARE_LABELS,
  type ShareLinkInput,
} from "../src/components/share-links.ts";

const CTX = { url: "https://example.com/post/hello/", text: "Hello World" };

describe("buildShareHref", () => {
  it("encodes the url and text into each network intent", () => {
    const u = encodeURIComponent(CTX.url);
    const t = encodeURIComponent(CTX.text);

    expect(buildShareHref("facebook", CTX)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    );
    expect(buildShareHref("x", CTX)).toBe(
      `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    );
    expect(buildShareHref("linkedin", CTX)).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    );
    expect(buildShareHref("bluesky", CTX)).toBe(
      `https://bsky.app/intent/compose?text=${t}%20${u}`,
    );
  });

  it("returns null for networks without a share-by-url intent", () => {
    expect(buildShareHref("instagram", CTX)).toBeNull();
    expect(buildShareHref("copy", CTX)).toBeNull();
  });

  it("tolerates missing text", () => {
    const href = buildShareHref("x", { url: CTX.url });
    expect(href).toContain("&text=");
    expect(href).not.toContain("undefined");
  });
});

describe("resolveShareLinks", () => {
  it("preserves the caller-given order", () => {
    const inputs: ShareLinkInput[] = [
      { network: "bluesky" },
      { network: "facebook" },
      { network: "x" },
      { network: "copy" },
    ];
    const order = resolveShareLinks(inputs, CTX).map((r) => r.network);
    expect(order).toEqual(["bluesky", "facebook", "x", "copy"]);
  });

  it("renders each network at most once (first entry wins)", () => {
    const inputs: ShareLinkInput[] = [
      { network: "x", label: "First X" },
      { network: "facebook" },
      { network: "x", label: "Second X" },
    ];
    const resolved = resolveShareLinks(inputs, CTX);
    expect(resolved.map((r) => r.network)).toEqual(["x", "facebook"]);
    expect(resolved[0].label).toBe("First X");
  });

  it("gives each network its own distinct href", () => {
    const resolved = resolveShareLinks(
      [
        { network: "facebook" },
        { network: "x" },
        { network: "linkedin" },
        { network: "bluesky" },
      ],
      CTX,
    );
    const hrefs = resolved.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("marks copy as a clipboard entry with no href", () => {
    const [copy] = resolveShareLinks([{ network: "copy" }], CTX);
    expect(copy.kind).toBe("copy");
    expect(copy.href).toBeUndefined();
    expect(copy.label).toBe(SHARE_LABELS.copy);
  });

  it("builds hrefs for link entries", () => {
    const [x] = resolveShareLinks([{ network: "x" }], CTX);
    expect(x.kind).toBe("link");
    expect(x.href).toContain("twitter.com/intent/tweet");
  });

  it("drops unsupported networks that lack an explicit href", () => {
    const resolved = resolveShareLinks([{ network: "instagram" }], CTX);
    expect(resolved).toHaveLength(0);
  });

  it("keeps an unsupported network when an explicit href is supplied", () => {
    const [ig] = resolveShareLinks(
      [{ network: "instagram", href: "https://instagram.com/goddess" }],
      CTX,
    );
    expect(ig.kind).toBe("link");
    expect(ig.href).toBe("https://instagram.com/goddess");
  });

  it("lets an explicit href override the built intent", () => {
    const [fb] = resolveShareLinks(
      [{ network: "facebook", href: "https://custom.example/share" }],
      CTX,
    );
    expect(fb.href).toBe("https://custom.example/share");
  });

  it("applies a per-entry label override, else the default", () => {
    const resolved = resolveShareLinks(
      [{ network: "x", label: "Post to X" }, { network: "facebook" }],
      CTX,
    );
    expect(resolved[0].label).toBe("Post to X");
    expect(resolved[1].label).toBe(SHARE_LABELS.facebook);
  });
});
