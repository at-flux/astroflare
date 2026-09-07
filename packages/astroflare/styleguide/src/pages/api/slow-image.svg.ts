import type { APIRoute } from "astro";

/**
 * A deliberately slow placeholder image, so the Suspense demos have something
 * real to wait for. `?delay=` is in ms (capped), `?label=` and `?hue=` only
 * change what it looks like.
 *
 * Served `no-store` on purpose: a cached second response would resolve inside
 * the grace window and the demo would stop demonstrating anything.
 */
export const GET: APIRoute = async ({ url }) => {
  const delay = Math.min(
    Math.max(Number(url.searchParams.get("delay") ?? 1200) || 0, 0),
    10_000,
  );
  const label = (url.searchParams.get("label") ?? `${delay}ms`).slice(0, 40);
  const hue = Number(url.searchParams.get("hue") ?? 220) || 220;

  await new Promise((resolve) => setTimeout(resolve, delay));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450" role="img" aria-label="${label}">
  <rect width="800" height="450" fill="hsl(${hue} 12% 82%)"/>
  <circle cx="400" cy="225" r="120" fill="hsl(${hue} 14% 72%)"/>
  <text x="50%" y="52%" fill="hsl(${hue} 18% 28%)" font-family="system-ui, sans-serif" font-size="40" text-anchor="middle" dominant-baseline="middle">${label}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
