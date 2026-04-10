import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, type HTMLElement } from "node-html-parser";
import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";

function walkHtmlFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkHtmlFiles(p));
    else if (ent.isFile() && ent.name.endsWith(".html")) out.push(p);
  }
  return out;
}

function namespaceAttrName(namespace: string): string {
  return `data-${toToken(namespace) || "ff"}`;
}

function elementFlagSlugs(
  el: HTMLElement,
  nsAttr: string,
  knownTokens: readonly string[],
): string[] {
  const slugSet = new Set<string>();
  const combined = el.getAttribute(nsAttr)?.trim();
  if (combined) {
    for (const part of combined.split(/\s+/).filter(Boolean)) {
      slugSet.add(part);
    }
  }
  for (const tk of knownTokens) {
    if (el.hasAttribute(`${nsAttr}-${tk}`)) slugSet.add(tk);
  }
  return [...slugSet];
}

function slugToFlagNames(slug: string, flagNames: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of flagNames) {
    if (slug === name || slug === toToken(name)) out.push(name);
  }
  return out;
}

function shouldCullElement(
  el: HTMLElement,
  runtime: ResolvedFeatureRuntime,
  nsAttr: string,
  knownTokens: readonly string[],
  flagNames: readonly string[],
): boolean {
  const slugs = elementFlagSlugs(el, nsAttr, knownTokens);
  if (slugs.length === 0) return false;
  for (const slug of slugs) {
    const names = slugToFlagNames(slug, flagNames);
    if (names.length === 0) return false;
  }
  for (const slug of slugs) {
    const names = slugToFlagNames(slug, flagNames);
    for (const name of names) {
      if (!runtime.flags[name]) return true;
    }
  }
  return false;
}

function elementDepth(el: HTMLElement): number {
  let d = 0;
  let n: HTMLElement | null = el.parentNode as HTMLElement | null;
  while (n) {
    d++;
    n = n.parentNode as HTMLElement | null;
  }
  return d;
}

/**
 * Production static HTML: remove nodes gated by disabled flags (same rules as dev
 * `data-*` / `data-*-<token>`), strip dev-only route attributes on `<html>`, and drop
 * empty `<style>` tags left after `featureFlagStyles` is empty.
 */
export function cullProductionHtml(
  html: string,
  runtime: ResolvedFeatureRuntime,
): string {
  const root = parse(html) as HTMLElement;
  const nsAttr = namespaceAttrName(runtime.namespace);
  const flagNames = Object.keys(runtime.flags);
  const knownTokens = flagNames.map((n) => toToken(n));

  const candidates = root.querySelectorAll("*") as unknown as HTMLElement[];
  const toRemove: HTMLElement[] = [];
  for (const el of candidates) {
    if (shouldCullElement(el, runtime, nsAttr, knownTokens, flagNames)) {
      toRemove.push(el);
    }
  }
  toRemove.sort((a, b) => elementDepth(b) - elementDepth(a));
  for (const el of toRemove) {
    el.remove();
  }

  const htmlEl = root.querySelector("html") as HTMLElement | null;
  if (htmlEl) {
    htmlEl.removeAttribute("data-ff-route");
    htmlEl.removeAttribute("data-ff-route-label");
  }

  const styles = root.querySelectorAll("style") as unknown as HTMLElement[];
  for (const st of styles) {
    const text = st.textContent ?? "";
    if (!text.trim()) st.remove();
  }

  return root.outerHTML;
}

/**
 * Walk `outDir` (e.g. Astro `dist/`) and apply {@link cullProductionHtml} to every `.html` file.
 */
export function applyProductionHtmlCullToDist(
  outDir: string,
  runtime: ResolvedFeatureRuntime,
): void {
  for (const file of walkHtmlFiles(outDir)) {
    const before = readFileSync(file, "utf8");
    const after = cullProductionHtml(before, runtime);
    if (after !== before) writeFileSync(file, after, "utf8");
  }
}
