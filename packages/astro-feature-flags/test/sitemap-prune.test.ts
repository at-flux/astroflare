import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applySitemapPruneToDist,
  getResolvedFeatures,
  pruneSitemapIndexXml,
  pruneSitemapXml,
  sitemapUrlCount,
} from "../src/index";

const OPTIONS = {
  flags: {
    sept: { routes: ["/faq/*", "/about/*"] },
    styleguide: { routes: ["/styleguide/*"] },
  },
  environments: {
    prod: { when: true, flags: { sept: false, styleguide: false } },
  },
};

function prodRuntime() {
  return getResolvedFeatures({
    ...OPTIONS,
    mode: "production",
    forceEnvironment: "prod",
  });
}

function urlset(paths: string[]): string {
  const entries = paths
    .map((p) => `  <url><loc>https://example.com${p}</loc></url>\n`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}</urlset>`;
}

function sitemapIndex(files: string[]): string {
  const entries = files
    .map((f) => `  <sitemap><loc>https://example.com/${f}</loc></sitemap>\n`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}</sitemapindex>`;
}

describe("pruneSitemapXml", () => {
  it("drops URLs whose route is culled from the build", () => {
    const xml = pruneSitemapXml(
      urlset(["/", "/about/", "/faq/", "/blog/"]),
      prodRuntime(),
    );
    expect(xml).not.toContain("/about/");
    expect(xml).not.toContain("/faq/");
    expect(xml).toContain("https://example.com/</loc>");
    expect(xml).toContain("https://example.com/blog/");
    expect(sitemapUrlCount(xml)).toBe(2);
  });

  it("keeps a route that merely starts with the same characters", () => {
    const xml = pruneSitemapXml(
      urlset(["/about/", "/blog/about-me/", "/aboutish/"]),
      prodRuntime(),
    );
    expect(xml).toContain("/blog/about-me/");
    expect(xml).toContain("/aboutish/");
    expect(sitemapUrlCount(xml)).toBe(2);
  });

  it("reads a loc through its XML entities", () => {
    const xml = pruneSitemapXml(
      `<urlset>
  <url><loc>https://example.com/about/?a=1&amp;b=2</loc></url>
  <url><loc>https://example.com/blog/?a=1&amp;b=2</loc></url>
  <url><loc>https://example.com/&#x66;aq/</loc></url>
</urlset>`,
      prodRuntime(),
    );
    expect(xml).not.toContain("/about/");
    expect(xml).not.toContain("aq/");
    expect(xml).toContain("/blog/");
    expect(sitemapUrlCount(xml)).toBe(1);
  });

  it("leaves a sitemap with nothing to prune byte-identical", () => {
    const before = urlset(["/", "/blog/"]);
    expect(pruneSitemapXml(before, prodRuntime())).toBe(before);
  });

  it("keeps entries it cannot read a pathname from", () => {
    const before = `<urlset><url><lastmod>2026-09-08</lastmod></url></urlset>`;
    expect(pruneSitemapXml(before, prodRuntime())).toBe(before);
  });

  it("prunes nothing while the flags are on", () => {
    const runtime = getResolvedFeatures({
      ...OPTIONS,
      environments: {
        prod: { when: true, flags: { sept: true, styleguide: true } },
      },
      mode: "production",
      forceEnvironment: "prod",
    });
    const before = urlset(["/", "/about/", "/faq/"]);
    expect(pruneSitemapXml(before, runtime)).toBe(before);
  });
});

describe("pruneSitemapIndexXml", () => {
  it("drops entries pointing at files that were deleted", () => {
    const xml = pruneSitemapIndexXml(
      sitemapIndex(["sitemap-0.xml", "sitemap-1.xml"]),
      ["sitemap-1.xml"],
    );
    expect(xml).toContain("sitemap-0.xml");
    expect(xml).not.toContain("sitemap-1.xml");
  });

  it("is a no-op when nothing was deleted", () => {
    const before = sitemapIndex(["sitemap-0.xml"]);
    expect(pruneSitemapIndexXml(before, [])).toBe(before);
  });
});

describe("applySitemapPruneToDist", () => {
  let dist: string;

  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), "aff-sitemap-"));
  });

  afterEach(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it("rewrites a urlset in place", () => {
    writeFileSync(join(dist, "sitemap-0.xml"), urlset(["/", "/about/"]));
    const result = applySitemapPruneToDist(dist, prodRuntime());
    expect(result.found).toBe(true);
    expect(result.rewritten).toEqual([join(dist, "sitemap-0.xml")]);
    expect(readFileSync(join(dist, "sitemap-0.xml"), "utf8")).not.toContain(
      "/about/",
    );
  });

  it("deletes an emptied urlset and its index entry", () => {
    writeFileSync(join(dist, "sitemap-0.xml"), urlset(["/", "/blog/"]));
    writeFileSync(join(dist, "sitemap-1.xml"), urlset(["/about/", "/faq/"]));
    writeFileSync(
      join(dist, "sitemap-index.xml"),
      sitemapIndex(["sitemap-0.xml", "sitemap-1.xml"]),
    );

    const result = applySitemapPruneToDist(dist, prodRuntime());

    expect(existsSync(join(dist, "sitemap-1.xml"))).toBe(false);
    expect(existsSync(join(dist, "sitemap-0.xml"))).toBe(true);
    const index = readFileSync(join(dist, "sitemap-index.xml"), "utf8");
    expect(index).toContain("sitemap-0.xml");
    expect(index).not.toContain("sitemap-1.xml");
    expect(result.removed).toContain(join(dist, "sitemap-1.xml"));
    expect(result.rewritten).toContain(join(dist, "sitemap-index.xml"));
  });

  it("deletes an index left with no sitemaps in it", () => {
    writeFileSync(join(dist, "sitemap-0.xml"), urlset(["/about/"]));
    writeFileSync(
      join(dist, "sitemap-index.xml"),
      sitemapIndex(["sitemap-0.xml"]),
    );
    applySitemapPruneToDist(dist, prodRuntime());
    expect(existsSync(join(dist, "sitemap-index.xml"))).toBe(false);
  });

  it("finds sitemaps written into a subdirectory", () => {
    mkdirSync(join(dist, "client"));
    writeFileSync(join(dist, "client", "sitemap.xml"), urlset(["/", "/faq/"]));
    applySitemapPruneToDist(dist, prodRuntime());
    expect(
      readFileSync(join(dist, "client", "sitemap.xml"), "utf8"),
    ).not.toContain("/faq/");
  });

  it("reports nothing found when the build wrote no sitemap", () => {
    writeFileSync(join(dist, "index.html"), "<html></html>");
    const result = applySitemapPruneToDist(dist, prodRuntime());
    expect(result).toEqual({ rewritten: [], removed: [], found: false });
  });

  it("ignores files that only look like sitemaps", () => {
    const before = "<html><body>sitemap</body></html>";
    writeFileSync(join(dist, "sitemap.xml"), before);
    const result = applySitemapPruneToDist(dist, prodRuntime());
    expect(result.rewritten).toEqual([]);
    expect(readFileSync(join(dist, "sitemap.xml"), "utf8")).toBe(before);
  });
});
