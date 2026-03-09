/**
 * Type-safe DOM helpers (inlined from @atflux/astroflare-dom for published bundle).
 */
export const getElementById = <T extends HTMLElement>(
  id: string,
  ctor: { new (...args: unknown[]): T } | (Function & { prototype: T }),
): T | null => {
  const element = document.getElementById(id);
  return element instanceof (ctor as Function) ? (element as T) : null;
};

export const getElementByIdOrThrow = <T extends HTMLElement>(
  id: string,
  ctor: { new (...args: unknown[]): T } | (Function & { prototype: T }),
): T => {
  const element = getElementById(id, ctor);
  if (!element) {
    throw new Error(`Element with id "${id}" not found or not the expected type`);
  }
  return element;
};

export const getElementByQuery = <T extends Element>(
  selector: string,
  root: Document | Element = document,
): T | null => {
  return root.querySelector<T>(selector);
};

export const getElementByQueryOrThrow = <T extends Element>(
  selector: string,
  root: Document | Element = document,
): T => {
  const element = getElementByQuery<T>(selector, root);
  if (!element) {
    throw new Error(`Element not found with selector "${selector}"`);
  }
  return element;
};

