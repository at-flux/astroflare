/**
 * Client runtime for Astro Action forms.
 *
 * Progressive-enhancement submit handler shared by every action form. A *root*
 * element opts in with `data-action-form` + `data-action-url`; it contains the
 * `<form>` plus the success/error/busy roles (marked with data attributes scoped to
 * the root, so no global element ids are needed and the success view may live as a
 * sibling of the form):
 *
 *   <form>                      the form (submit is intercepted)
 *   [data-action-form-submit]   submit control — disabled while in flight
 *   [data-action-form-spinner]  busy indicator — `hidden` toggled
 *   [data-action-form-label]    label text node — swapped idle ⇄ busy
 *   [data-action-form-view]     the form view — hidden on success
 *   [data-action-form-success]  success view — shown + focused on success
 *   [data-action-form-error]    error live region — message shown on failure
 *
 * Busy/idle label text is read from `data-label-busy` / `data-label-idle` on the
 * submit control. Success and error also dispatch bubbling `action-form:success` /
 * `action-form:error` CustomEvents so consumers can react (close a modal, etc.).
 *
 * On submit the form's native constraint validation runs first (`reportValidity`);
 * an invalid form aborts before any request. Any `[data-action-form-timestamp]`
 * input is stamped with the current ISO time at submit (for consent timestamps).
 */

const INIT_ATTR = "data-action-form-init";

const q = <T extends Element>(root: ParentNode, sel: string): T | null =>
  root.querySelector<T>(sel);

const setBusy = (root: HTMLElement, busy: boolean): void => {
  const submit = q<HTMLButtonElement>(root, "[data-action-form-submit]");
  const spinner = q<HTMLElement>(root, "[data-action-form-spinner]");
  const label = q<HTMLElement>(root, "[data-action-form-label]");

  if (submit) {
    submit.disabled = busy;
    submit.setAttribute("aria-busy", busy ? "true" : "false");
    const next = busy ? submit.dataset.labelBusy : submit.dataset.labelIdle;
    if (label && next != null) label.textContent = next;
  }
  if (spinner) spinner.hidden = !busy;
};

const showSuccess = (root: HTMLElement): void => {
  const view = q<HTMLElement>(root, "[data-action-form-view]");
  const success = q<HTMLElement>(root, "[data-action-form-success]");
  if (view) view.hidden = true;
  if (success) {
    success.hidden = false;
    success.setAttribute("tabindex", "-1");
    success.focus();
    success.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }
  root.dispatchEvent(new CustomEvent("action-form:success", { bubbles: true }));
};

const showError = (root: HTMLElement, message: string): void => {
  const error = q<HTMLElement>(root, "[data-action-form-error]");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  root.dispatchEvent(
    new CustomEvent("action-form:error", {
      bubbles: true,
      detail: { message },
    }),
  );
};

/** Astro Action form responses serialize as `[keys, success, …]`; success is index 1. */
const readSuccess = (result: unknown): boolean =>
  Array.isArray(result) && result.length >= 2 ? Boolean(result[1]) : true;

const onSubmit = async (
  root: HTMLElement,
  form: HTMLFormElement,
  event: SubmitEvent,
): Promise<void> => {
  event.preventDefault();
  const url = root.dataset.actionUrl;
  if (!url) return;

  // Native constraint validation (required fields, email format, checked consent).
  if (typeof form.reportValidity === "function" && !form.reportValidity())
    return;

  // Stamp submit-time timestamps (e.g. consent timestamps).
  form
    .querySelectorAll<HTMLInputElement>("[data-action-form-timestamp]")
    .forEach((input) => {
      input.value = new Date().toISOString();
    });

  const errorRegion = q<HTMLElement>(root, "[data-action-form-error]");
  if (errorRegion) errorRegion.hidden = true;

  const fail = () =>
    showError(
      root,
      root.dataset.errorMessage ?? "Something went wrong. Please try again.",
    );

  setBusy(root, true);
  let succeeded = false;
  try {
    const response = await fetch(url, {
      method: "POST",
      body: new FormData(form),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && readSuccess(result)) {
      succeeded = true;
      showSuccess(root);
    } else {
      fail();
    }
  } catch {
    fail();
  } finally {
    // On success the form view is swapped out; only a failed submit re-enables it.
    if (!succeeded) setBusy(root, false);
  }
};

/** Wire submit handling on every un-initialised action-form root under `scope`. */
export const initActionFormRoots = (scope: ParentNode = document): void => {
  const roots = scope.querySelectorAll<HTMLElement>(
    `[data-action-form]:not([${INIT_ATTR}="true"])`,
  );
  roots.forEach((root) => {
    const form = root.querySelector("form");
    if (!form) return;
    root.setAttribute(INIT_ATTR, "true");
    form.addEventListener("submit", (event) => {
      void onSubmit(root, form, event as SubmitEvent);
    });
  });
};
