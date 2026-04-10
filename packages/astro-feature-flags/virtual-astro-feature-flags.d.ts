declare module "virtual:astro-feature-flags" {
  export const FeatureFlag: Record<string, string>;
  /** Slug tokens for `data-ff` (use on elements). */
  export const FeatureToken: Record<string, string>;
  export const featureFlagTokens: readonly string[];
  export const featureFlagColors: Readonly<Record<string, string>>;
  export const featureFlags: Readonly<Record<string, boolean>>;
  export const featureRouteFlags: Readonly<Record<string, string[]>>;
  export const featureNamespace: string;
  export const featureMode: string;
  export const isDev: boolean;
  /** Dev-only outline/badge CSS; empty string in production (static HTML is culled instead). */
  export const featureFlagStyles: string;
  /** Inline script for dev toolbar + `data-ff-*` on `<html>` (empty string in production). */
  export const affDevBootstrap: string;

  export function isFeatureEnabled(flag: string): boolean;
  /** Same as `isFeatureEnabled` — SSR follows `ff.json`; dev toolbar does not change server output. */
  export function shouldRenderFeature(flag: string): boolean;
  export function isFeatureRoute(pathname: string): boolean;
  export function shouldIncludePath(pathname: string): boolean;
  /** Ignore dev mode and evaluate as production route gating. */
  export function shouldIncludePathInProduction(pathname: string): boolean;
  export function matchedFeatureRoutePrefix(pathname: string): string | null;
  /** Longest `routes` match → flag token for `data-ff-route` on `<html>` (dev route pill). */
  export function routeFeatureTokenForPath(
    pathname: string,
  ): string | undefined;
  /** Longest `routes` match → all flag tokens for the route (for multi-flag route badges). */
  export function routeFeatureTokensForPath(pathname: string): string[];
  /** All matching route patterns grouped by feature for a pathname. */
  export function routeFeatureMatchesForPath(pathname: string): Array<{
    flag: string;
    token: string;
    routes: string[];
  }>;
}
