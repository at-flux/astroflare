import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";
import { routePrefixJsHelper } from "./route-prefix-js";

/**
 * Single `injectScript('head-inline', …)` payload for `astro dev`: dev-only outline CSS,
 * `data-ff-route` on `<html>` (pathname + {@link ResolvedFeatureRuntime.routeFlags}), then
 * the feature-flag dev bootstrap (toolbar state, combo badges, route-pruned overlay).
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
  const rf = JSON.stringify(runtime.routeFlags);
  const m = JSON.stringify(flagNameToToken);
  const css = JSON.stringify(featureFlagStyles);
  const affPfx = routePrefixJsHelper("affPfx");
  const setup = `(function(){try{var s=document.createElement('style');s.setAttribute('data-astro-feature-flags','');s.textContent=${css};(document.head||document.documentElement).appendChild(s);var RF=${rf};var M=${m};${affPfx}function affToks(pathname){pathname=pathname||'/';if(!pathname.endsWith('/'))pathname+='/';var out=[];var seen=new Set();for(var rp in RF){if(!Object.prototype.hasOwnProperty.call(RF,rp))continue;var route=affPfx(rp);if(!(pathname===route||pathname.indexOf(route)===0))continue;var fns=RF[rp]||[];for(var i=0;i<fns.length;i++){var fn=fns[i];var tk=M[fn];if(tk&&!seen.has(tk)){seen.add(tk);out.push(tk);}}}return out.join(' ')}function affApply(){document.documentElement.setAttribute('data-ff-route',affToks(typeof location!=='undefined'?location.pathname:'/'));}affApply();document.addEventListener('astro:page-load',affApply);document.addEventListener('astro:after-swap',affApply);}catch(_){}})();`;
  return `${setup}\n${affDevBootstrap}`;
}
