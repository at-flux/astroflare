import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";
import { compactInlineScript } from "./inline-script";
import { routePrefixJsHelper } from "./route-prefix-js";

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
  const rf = JSON.stringify(runtime.routeFlags);
  const m = JSON.stringify(flagNameToToken);
  const css = JSON.stringify(featureFlagStyles);
  const affPfx = routePrefixJsHelper("affPfx");
  const setup = compactInlineScript(`
    (function () {
      try {
        var s = document.createElement('style');
        s.setAttribute('data-astro-feature-flags', '');
        s.textContent = ${css};
        (document.head || document.documentElement).appendChild(s);
        var RF = ${rf};
        var M = ${m};
        ${affPfx}

        function affPath() {
          var p = (typeof location !== 'undefined' && location.pathname) ? location.pathname : '/';
          if (!p.endsWith('/')) p += '/';
          return p;
        }

        function affToks(pathname) {
          pathname = pathname || '/';
          if (!pathname.endsWith('/')) pathname += '/';
          var out = [];
          var seen = new Set();
          for (var rp in RF) {
            if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
            var route = affPfx(rp);
            if (!(pathname === route || pathname.indexOf(route) === 0)) continue;
            var fns = RF[rp] || [];
            for (var i = 0; i < fns.length; i++) {
              var fn = fns[i];
              var tk = M[fn];
              if (tk && !seen.has(tk)) {
                seen.add(tk);
                out.push(tk);
              }
            }
          }
          return out;
        }

        function affFlagNames(pathname) {
          pathname = pathname || '/';
          if (!pathname.endsWith('/')) pathname += '/';
          var out = [];
          var seen = new Set();
          for (var rp in RF) {
            if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
            var route = affPfx(rp);
            if (!(pathname === route || pathname.indexOf(route) === 0)) continue;
            var fns = RF[rp] || [];
            for (var i = 0; i < fns.length; i++) {
              var fn = fns[i];
              if (fn && !seen.has(fn)) {
                seen.add(fn);
                out.push(fn);
              }
            }
          }
          return out;
        }

        function affSyncDisabledOverlay() {
          var root = document.documentElement;
          if (!document.body) return;
          var path = affPath();
          var names = affFlagNames(path);
          var disabled = [];
          for (var i = 0; i < names.length; i++) {
            var tk = M[names[i]];
            if (!tk) continue;
            if (root.getAttribute('data-ff-enabled-' + tk) === 'off') disabled.push(tk);
          }
          var id = 'aff-route-disabled-overlay';
          var el = document.getElementById(id);
          if (!disabled.length) {
            if (el) el.remove();
            root.removeAttribute('data-aff-route-disabled');
            return;
          }
          root.setAttribute('data-aff-route-disabled', '');
          if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'aff-route-disabled-overlay';
            var p = document.createElement('p');
            el.appendChild(p);
            document.body.appendChild(el);
          }
          var pEl = el.querySelector('p') || el;
          var flagsText = disabled.join(', ');
          var line1 = disabled.length === 1
            ? ('Page disabled: ' + flagsText + ' flag is disabled.')
            : ('Page disabled: ' + flagsText + ' flags are disabled.');
          var line2 = 'In production builds, pages with disabled flags like this will not be emitted';
          pEl.textContent = line1 + '\\n' + line2;
        }

        function affApply() {
          var toks = affToks(affPath());
          document.documentElement.setAttribute('data-ff-route', toks.join(' '));
          affSyncDisabledOverlay();
        }

        affApply();
        if (typeof MutationObserver === 'function') {
          var obs = new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
              var a = muts[i] && muts[i].attributeName;
              if (a === 'data-ff-route' || (a && a.indexOf('data-ff-enabled-') === 0)) {
                affSyncDisabledOverlay();
                break;
              }
            }
          });
          obs.observe(document.documentElement, { attributes: true });
        }
        document.addEventListener('astro:page-load', affApply);
        document.addEventListener('astro:after-swap', affApply);
      } catch (_) {}
    })();
  `);
  return `${setup}\n${affDevBootstrap}`;
}
