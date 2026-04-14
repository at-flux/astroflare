declare module "virtual:astro-feature-flags" {
  export const FeatureFlag: Record<string, string>;
  /** Slug tokens for `data-ff` (use on elements). */
  export const FeatureToken: Record<string, string>;
  export const featureFlagTokens: readonly string[];
  export const featureFlagColors: Readonly<Record<string, string>>;
  /** Flags for the active build environment (reserved layer name `dev` = all on). */
  export const featureFlags: Readonly<Record<string, boolean>>;
  /**
   * Resolved booleans per configured environment key (`staging`, `prod`, …). The reserved
   * **`dev`** entry is the Astro “all flags on” layer; any other key is a normal layer.
   */
  export const featureFlagsByEnvironment: Readonly<
    Record<string, Readonly<Record<string, boolean>>>
  >;
  /**
   * Default non-`dev` layer for helpers: `prod` if defined, otherwise the first other key
   * (sorted). Use with {@link shouldIncludePathForEnvironment} when you want “compare to
   * primary shipped layer” without hard-coding `prod`.
   */
  export const defaultNonDevEnvironment: string;
  export const featureRouteFlags: Readonly<Record<string, string[]>>;
  export const featureNamespace: string;
  export const featureMode: string;
  /** Which environment layer this build resolved to (reserved name `dev` = toolbar + all flags on). */
  export const activeEnvironmentKey: string;
  /**
   * Astro’s dev server / `import.meta.env.DEV`. Not the same as `activeEnvironmentKey === "dev"`.
   */
  export const isAstroDev: boolean;
  /** Dev-only outline/badge CSS; empty string in production (static HTML is culled instead). */
  export const featureFlagStyles: string;
  /** Inline script for dev toolbar + `data-ff-*` on `<html>` (empty string in production). */
  export const affDevBootstrap: string;

  export function isFeatureEnabled(flag: string): boolean;
  /** Map for a named layer, or `null` if unknown. */
  export function flagsForEnvironment(
    envName: string,
  ): Readonly<Record<string, boolean>> | null;
  export function isFeatureEnabledForEnvironment(
    flag: string,
    envName: string,
  ): boolean;
  /** Same as `isFeatureEnabled` — SSR follows the active layer; dev toolbar does not change server output. */
  export function shouldRenderFeature(flag: string): boolean;
  export function isFeatureRoute(pathname: string): boolean;
  export function shouldIncludePath(pathname: string): boolean;
  /** Route gating for an arbitrary configured layer (e.g. `prod`, `staging`). */
  export function shouldIncludePathForEnvironment(
    pathname: string,
    envName: string,
  ): boolean;
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
