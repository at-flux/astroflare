import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";
import { inlineInvoke } from "./inline-script";
import { affHeadInlineRuntime } from "./dev-inline-runtimes";

/**
 * Single `injectScript('head-inline', …)` payload for `astro dev`: dev-only outline CSS,
 * `data-ff-route` on `<html>` (pathname + {@link ResolvedFeatureRuntime.routeFlags}), then
 * the feature-flag dev bootstrap (toolbar state, combo badges, route chrome).
 */
export function buildAffDevHeadInline(args: {
  runtime: ResolvedFeatureRuntime;
  featureFlagStyles: string;
  affDevBootstrap: string;
}): string {
  const { runtime, featureFlagStyles, affDevBootstrap } = args;
  const flagNameToToken = Object.fromEntries(
    Object.keys(runtime.flags).map((name) => [name, toToken(name)]),
  );
  const setup = inlineInvoke(affHeadInlineRuntime, {
    featureFlagStyles,
    routeFlags: runtime.routeFlags,
    flagNameToToken,
  });
  return `${setup}\n${affDevBootstrap}`;
}
