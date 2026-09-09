/**
 * One source of "now" for everything in this package.
 *
 * A build-time timestamp, a countdown, a consent stamp on a submitted form: all
 * of them read the clock, and every one of them is untestable and unpreviewable
 * while that read is a bare `Date.now()` buried in the module that needs it.
 * Reading through here instead means a test can pin the instant, and a
 * styleguide can show September, October and December of the same component
 * without lying about which day it is.
 *
 * The default is the system clock, so nothing changes for code that never touches
 * this. `setClock` is deliberately global rather than a parameter threaded
 * through every call: the callers are Astro frontmatter and DOM event handlers,
 * which have nowhere to thread it from.
 *
 * @example Pin the clock for a test
 * setClock("2026-10-01T00:00:00Z");
 * expect(renderFooter()).toContain("01/10/2026");
 * resetClock();
 *
 * @example Freeze it for one block, restore it whatever happens
 * const html = withClock(new Date("2026-12-25"), () => render(page));
 */
export type Clock = () => number;

/** Anything that can name an instant. A `Clock` is re-read on every call. */
export type ClockSource = Clock | Date | number | string;

const systemClock: Clock = () => Date.now();

let current: Clock = systemClock;

function toClock(source: ClockSource): Clock {
  if (typeof source === "function") return source;
  const fixed =
    source instanceof Date
      ? source.getTime()
      : typeof source === "number"
        ? source
        : new Date(source).getTime();
  if (!Number.isFinite(fixed)) {
    throw new Error(`clock: ${String(source)} is not a usable instant`);
  }
  return () => fixed;
}

/**
 * Point the clock at a fixed instant, or at a function that decides each read.
 *
 * Process-global, and deliberately so — see the note above. On a server that
 * means every in-flight request, so this belongs in tests, styleguides and
 * build-time previews, never in a request handler wanting its own notion of now.
 * A request that needs a specific instant should be passed one.
 */
export function setClock(source: ClockSource): void {
  current = toClock(source);
}

/** Back to the system clock. Call it in a test teardown. */
export function resetClock(): void {
  current = systemClock;
}

/** Milliseconds since the epoch, as `Date.now()` would give them. */
export function nowMs(): number {
  return current();
}

/** The current instant as a fresh `Date`, safe for the caller to mutate. */
export function now(): Date {
  return new Date(current());
}

/**
 * Run `fn` with the clock pinned, then put back whatever was there before —
 * including a clock a surrounding `withClock` had set.
 *
 * An async `fn` is waited for before the restore, so concurrent calls with
 * different instants will still fight over the one global clock. That is the
 * price of not threading it through every signature; pin it around the narrowest
 * block you can.
 */
export function withClock<T>(source: ClockSource, fn: () => T): T {
  const previous = current;
  setClock(source);
  let settled = false;
  try {
    const result = fn();
    if (
      result &&
      typeof (result as { then?: unknown }).then === "function" &&
      typeof (result as { finally?: unknown }).finally === "function"
    ) {
      settled = true;
      return (result as unknown as Promise<unknown>).finally(() => {
        current = previous;
      }) as T;
    }
    return result;
  } finally {
    if (!settled) current = previous;
  }
}
