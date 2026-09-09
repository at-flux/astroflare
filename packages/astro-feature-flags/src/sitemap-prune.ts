import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { ResolvedFeatureRuntime } from "./runtime";
import { shouldIncludeRoute } from "./runtime";

/**
 * `@astrojs/sitemap` names its output `sitemap-0.xml`, `sitemap-1.xml`, … alongside a
 * `sitemap-index.xml`. Other generators write a plain `sitemap.xml`. Match the family.
 */
const SITEMAP_FILE = /^sitemap[\w.-]*\.xml$/i;

function walkSitemapFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkSitemapFiles(p));
    else if (ent.isFile() && SITEMAP_FILE.test(ent.name)) out.push(p);
  }
  return out;
}

/**
 * `<loc>` is XML, so the five predefined entities and numeric references are all
 * legal in it. `&amp;` is the one that actually turns up (a query string with two
 * parameters), but a path that came through an escaper wholesale can carry the
 * others, and an entity left undecoded turns into a pathname that matches no
 * route and is silently kept.
 */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function locPathname(entry: string): string | null {
  const loc = /<loc>\s*([\s\S]*?)\s*<\/loc>/i.exec(entry)?.[1];
  if (!loc) return null;
  const href = decodeXmlEntities(loc).trim();
  try {
    return new URL(href).pathname;
  } catch {
    return href.startsWith("/") ? href : null;
  }
}

/**
 * Drop every `<url>` whose `<loc>` points at a route this runtime prunes.
 *
 * The alternative is asking every site to duplicate the flag decision in its own
 * `sitemap({ filter })`, which is what the docs used to say and what the site this
 * package was written for got subtly wrong: a substring test culled `/blog/about-x/`
 * along with `/about/`. Deciding it here, from the same runtime that deletes the
 * files, means the two answers cannot drift.
 *
 * String surgery rather than an XML parse, so the untouched entries come back
 * byte-identical and the diff of a rebuild stays readable.
 */
export function pruneSitemapXml(
  xml: string,
  runtime: ResolvedFeatureRuntime,
): string {
  return xml.replace(/[ \t]*<url>[\s\S]*?<\/url>\s*/gi, (entry) => {
    const pathname = locPathname(entry);
    if (!pathname) return entry;
    const keep = shouldIncludeRoute({
      pathname,
      routeFlags: runtime.routeFlags,
      flags: runtime.flags,
      isDev: false,
    });
    return keep ? entry : "";
  });
}

/** Number of `<url>` entries left in a urlset. */
export function sitemapUrlCount(xml: string): number {
  return (xml.match(/<url>/gi) ?? []).length;
}

/**
 * Remove the `<sitemap>` entries of an index that point at files which no longer exist.
 */
export function pruneSitemapIndexXml(
  xml: string,
  removedFiles: readonly string[],
): string {
  if (!removedFiles.length) return xml;
  const removed = new Set(removedFiles);
  return xml.replace(/[ \t]*<sitemap>[\s\S]*?<\/sitemap>\s*/gi, (entry) => {
    const pathname = locPathname(entry);
    if (!pathname) return entry;
    return removed.has(basename(pathname)) ? "" : entry;
  });
}

export interface SitemapPruneResult {
  /** Sitemap files rewritten with fewer entries. */
  rewritten: string[];
  /** Sitemap files deleted because nothing was left in them. */
  removed: string[];
  /** Whether any sitemap file was found at all. */
  found: boolean;
}

/**
 * Walk `outDir` (Astro `dist/`) and take the pruned routes out of every sitemap.
 *
 * Runs in `astro:build:done`, which means this integration has to sit **after**
 * `@astrojs/sitemap` in `integrations` — Astro runs the hook in array order, and a
 * sitemap written after this pass would keep its dead URLs.
 */
export function applySitemapPruneToDist(
  outDir: string,
  runtime: ResolvedFeatureRuntime,
): SitemapPruneResult {
  const result: SitemapPruneResult = {
    rewritten: [],
    removed: [],
    found: false,
  };
  let files: string[];
  try {
    files = walkSitemapFiles(outDir);
  } catch {
    return result;
  }
  result.found = files.length > 0;

  const indexes: string[] = [];
  for (const file of files) {
    const before = readFileSync(file, "utf8");
    if (!/<urlset[\s>]/i.test(before)) {
      if (/<sitemapindex[\s>]/i.test(before)) indexes.push(file);
      continue;
    }
    const after = pruneSitemapXml(before, runtime);
    if (after === before) continue;
    if (sitemapUrlCount(after) === 0) {
      rmSync(file, { force: true });
      result.removed.push(file);
    } else {
      writeFileSync(file, after, "utf8");
      result.rewritten.push(file);
    }
  }

  const removedNames = result.removed.map((file) => basename(file));
  for (const file of indexes) {
    const before = readFileSync(file, "utf8");
    const after = pruneSitemapIndexXml(before, removedNames);
    if (after === before) continue;
    if (!/<sitemap>/i.test(after)) {
      rmSync(file, { force: true });
      result.removed.push(file);
    } else {
      writeFileSync(file, after, "utf8");
      result.rewritten.push(file);
    }
  }

  return result;
}
