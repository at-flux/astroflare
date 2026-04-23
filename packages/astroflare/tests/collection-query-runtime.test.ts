// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initCollectionQueryElement } from "../src/runtime/collection-query";

const createRoot = () => {
  document.body.innerHTML = `
    <collection-query data-af-query data-per-page="2">
      <button data-filter="all" class="is-active">All</button>
      <button data-filter="ai">AI</button>
      <button data-filter="sites">Sites</button>
      <div data-card data-tags="ai|tech">Card 1</div>
      <div data-card data-tags="sites">Card 2</div>
      <div data-card data-tags="ai">Card 3</div>
      <div data-pagination></div>
    </collection-query>
  `;
  return document.querySelector("collection-query") as HTMLElement;
};

describe("collection query runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("initializes and paginates visible cards", () => {
    const root = createRoot();
    initCollectionQueryElement(root);

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    expect(cards[0].style.display).toBe("");
    expect(cards[1].style.display).toBe("");
    expect(cards[2].style.display).toBe("none");

    const pagerButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pagination] button[data-page]'));
    expect(pagerButtons).toHaveLength(2);
    expect(pagerButtons[0].className).toContain("af-pager-pill");
    expect(pagerButtons[0].className).toContain("is-active");
    expect(pagerButtons[1].className).toContain("af-pager-pill");
  });

  it("collapses long pagination into an ellipsis window", () => {
    document.body.innerHTML = `
      <collection-query data-af-query data-per-page="1" data-max-page-buttons="5">
        <button data-filter="all" class="is-active">All</button>
        <div data-card data-tags="a">Card 1</div>
        <div data-card data-tags="a">Card 2</div>
        <div data-card data-tags="a">Card 3</div>
        <div data-card data-tags="a">Card 4</div>
        <div data-card data-tags="a">Card 5</div>
        <div data-card data-tags="a">Card 6</div>
        <div data-card data-tags="a">Card 7</div>
        <div data-pagination></div>
      </collection-query>
    `;

    const root = document.querySelector("collection-query") as HTMLElement;
    initCollectionQueryElement(root);

    const pagination = root.querySelector("[data-pagination]");
    expect(pagination?.textContent).toContain("…");
    expect(root.querySelectorAll('[data-pagination] button[data-page]').length).toBeLessThan(7);
  });

  it("filters cards and updates active filter class", () => {
    const root = createRoot();
    initCollectionQueryElement(root);

    const aiButton = root.querySelector<HTMLButtonElement>('[data-filter="ai"]');
    aiButton?.click();

    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-card]"));
    expect(cards[0].style.display).toBe("");
    expect(cards[1].style.display).toBe("none");
    expect(cards[2].style.display).toBe("");
    expect(aiButton?.classList.contains("is-active")).toBe(true);
  });

  it("is idempotent when initialized repeatedly", () => {
    const root = createRoot();
    initCollectionQueryElement(root);
    const firstMarkup = root.innerHTML;
    initCollectionQueryElement(root);
    expect(root.dataset.afInit).toBe("true");
    expect(root.innerHTML).toBe(firstMarkup);
  });
});
