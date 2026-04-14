/**
 * Shared JS helper source used by generated browser scripts.
 * Keep this in sync with runtime.routePatternToPrefix semantics.
 */
export function routePrefixJsHelper(functionName: string): string {
  return `function ${functionName}(pattern){var p=String(pattern||'').trim();if(p.endsWith('/**'))p=p.slice(0,-3);else if(p.endsWith('/*'))p=p.slice(0,-2);else if(p.length>1&&p.endsWith('*'))p=p.slice(0,-1);return p.endsWith('/')?p:p+'/';}`;
}
