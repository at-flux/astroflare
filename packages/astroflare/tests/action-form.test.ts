// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initActionFormRoots } from "../src/runtime/action-form";

const FORM_HTML = `
  <div data-action-form data-action-url="/_actions/contact/">
    <div data-action-form-success hidden>Thank you</div>
    <div data-action-form-view>
      <form>
        <input name="email" value="a@b.co" />
        <div data-action-form-error hidden></div>
        <button
          type="submit"
          data-action-form-submit
          data-label-idle="Send"
          data-label-busy="Sending…"
        >
          <span data-action-form-spinner hidden></span>
          <span data-action-form-label>Send</span>
        </button>
      </form>
    </div>
  </div>
`;

const els = () => {
  const root = document.querySelector<HTMLElement>("[data-action-form]")!;
  const form = root.querySelector<HTMLFormElement>("form")!;
  return {
    root,
    form,
    submit: root.querySelector<HTMLButtonElement>("[data-action-form-submit]")!,
    spinner: root.querySelector<HTMLElement>("[data-action-form-spinner]")!,
    label: root.querySelector<HTMLElement>("[data-action-form-label]")!,
    view: root.querySelector<HTMLElement>("[data-action-form-view]")!,
    success: root.querySelector<HTMLElement>("[data-action-form-success]")!,
    error: root.querySelector<HTMLElement>("[data-action-form-error]")!,
  };
};

const submitForm = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("action form runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = FORM_HTML;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the success view and dispatches success on a successful submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => [["email"], true] }),
    );
    const { root, form, submit, view, success } = els();
    const onSuccess = vi.fn();
    root.addEventListener("action-form:success", onSuccess);

    initActionFormRoots();
    submitForm(form);
    await flush();

    expect(view.hidden).toBe(true);
    expect(success.hidden).toBe(false);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(submit.disabled).toBe(true); // stays busy; view is gone
  });

  it("re-enables the button and shows the error on an unsuccessful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => [["email"], false] }),
    );
    const { form, submit, spinner, label, error, view } = els();

    initActionFormRoots();
    submitForm(form);
    await flush();

    expect(view.hidden).toBe(false);
    expect(error.hidden).toBe(false);
    expect(submit.disabled).toBe(false);
    expect(spinner.hidden).toBe(true);
    expect(label.textContent).toBe("Send");
  });

  it("recovers from a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { root, form, submit, error } = els();
    const onError = vi.fn();
    root.addEventListener("action-form:error", onError);

    initActionFormRoots();
    submitForm(form);
    await flush();

    expect(error.hidden).toBe(false);
    expect(submit.disabled).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
  });

  it("aborts submit when native constraint validation fails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { form } = els();
    // Force the form invalid regardless of field state.
    form.reportValidity = vi.fn().mockReturnValue(false);

    initActionFormRoots();
    submitForm(form);
    await flush();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stamps submit-time timestamps into marked inputs", async () => {
    let sent: FormData | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        sent = init.body as FormData;
        return Promise.resolve({ ok: true, json: async () => [[], true] });
      }),
    );
    const { form } = els();
    const stamp = document.createElement("input");
    stamp.type = "hidden";
    stamp.name = "consentTimestamp";
    stamp.setAttribute("data-action-form-timestamp", "");
    form.appendChild(stamp);

    initActionFormRoots();
    submitForm(form);
    await flush();

    expect(stamp.value).not.toBe("");
    expect(sent?.get("consentTimestamp")).toBe(stamp.value);
  });

  it("binds each form only once across repeated init passes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [[], true] });
    vi.stubGlobal("fetch", fetchMock);
    const { root, form } = els();

    initActionFormRoots();
    initActionFormRoots();
    expect(root.getAttribute("data-action-form-init")).toBe("true");

    submitForm(form);
    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
