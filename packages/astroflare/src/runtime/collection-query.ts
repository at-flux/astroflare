export interface CollectionQueryRuntimeOptions {
  cardSelector: string;
  filterSelector: string;
  paginationSelector: string;
  perPage: number;
  activeClass: string;
  tagSeparator: string;
  pageButtonClass: string;
  ellipsisClass: string;
  maxPageButtons: number;
}

const DEFAULTS: CollectionQueryRuntimeOptions = {
  cardSelector: "[data-card]",
  filterSelector: "[data-filter]",
  paginationSelector: "[data-pagination]",
  perPage: 9,
  activeClass: "is-active",
  tagSeparator: "|",
  pageButtonClass: "af-pager-pill",
  ellipsisClass: "af-pager-ellipsis",
  maxPageButtons: 7,
};

const getConfig = (root: HTMLElement): CollectionQueryRuntimeOptions => {
  const {
    cardSelector,
    filterSelector,
    paginationSelector,
    perPage,
    activeClass,
    tagSeparator,
    pageButtonClass,
    ellipsisClass,
    maxPageButtons,
  } = root.dataset;

  return {
    cardSelector: cardSelector ?? DEFAULTS.cardSelector,
    filterSelector: filterSelector ?? DEFAULTS.filterSelector,
    paginationSelector: paginationSelector ?? DEFAULTS.paginationSelector,
    perPage: Number(perPage ?? DEFAULTS.perPage),
    activeClass: activeClass ?? DEFAULTS.activeClass,
    tagSeparator: tagSeparator ?? DEFAULTS.tagSeparator,
    pageButtonClass: pageButtonClass ?? DEFAULTS.pageButtonClass,
    ellipsisClass: ellipsisClass ?? DEFAULTS.ellipsisClass,
    maxPageButtons: Number(maxPageButtons ?? DEFAULTS.maxPageButtons),
  };
};

export const getClientPageSequence = (
  totalPages: number,
  currentPage: number,
  maxButtons: number,
): Array<number | "…"> => {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const innerSlots = Math.max(1, maxButtons - 2);
  const left = Math.max(2, currentPage - Math.floor(innerSlots / 2));
  const right = Math.min(totalPages - 1, left + innerSlots - 1);
  const adjustedLeft = Math.max(2, right - innerSlots + 1);

  const sequence: Array<number | "…"> = [1];
  if (adjustedLeft > 2) sequence.push("…");
  for (let page = adjustedLeft; page <= right; page += 1) sequence.push(page);
  if (right < totalPages - 1) sequence.push("…");
  sequence.push(totalPages);
  return sequence;
};

export const initCollectionQueryElement = (root: HTMLElement): void => {
  if (root.dataset.afInit === "true") return;
  root.dataset.afInit = "true";

  const config = getConfig(root);
  const cards = Array.from(root.querySelectorAll<HTMLElement>(config.cardSelector));
  const filters = Array.from(root.querySelectorAll<HTMLButtonElement>(config.filterSelector));
  const pagination = root.querySelector<HTMLElement>(config.paginationSelector);

  let page = 1;
  let activeFilter = filters.find((button) => button.classList.contains(config.activeClass))?.dataset.filter ?? "all";

  const filterCards = (): HTMLElement[] =>
    cards.filter((card) => {
      if (activeFilter === "all") return true;
      const tags = (card.dataset.tags ?? "").split(config.tagSeparator);
      return tags.includes(activeFilter);
    });

  const renderPagination = (totalPages: number) => {
    if (!pagination) return;
    pagination.innerHTML = "";
    if (totalPages <= 1) return;

    const pages = getClientPageSequence(totalPages, page, config.maxPageButtons);
    for (const entry of pages) {
      if (entry === "…") {
        const ellipsis = document.createElement("span");
        ellipsis.className = config.ellipsisClass;
        ellipsis.textContent = "…";
        ellipsis.setAttribute("aria-hidden", "true");
        pagination.appendChild(ellipsis);
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.dataset.page = String(entry);
      button.textContent = String(entry);
      button.className = [config.pageButtonClass, entry === page ? config.activeClass : ""]
        .filter(Boolean)
        .join(" ");
      button.addEventListener("click", () => {
        page = entry;
        render();
      });
      pagination.appendChild(button);
    }
  };

  const render = () => {
    const filtered = filterCards();
    const totalPages = Math.max(1, Math.ceil(filtered.length / config.perPage));
    page = Math.min(page, totalPages);

    const start = (page - 1) * config.perPage;
    const end = start + config.perPage;

    cards.forEach((card) => {
      card.style.display = "none";
    });
    filtered.slice(start, end).forEach((card) => {
      card.style.display = "";
    });

    renderPagination(totalPages);
  };

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter ?? "all";
      page = 1;
      filters.forEach((item) => item.classList.toggle(config.activeClass, item === button));
      render();
    });
  });

  render();
};

export const initCollectionQueryRoots = (scope: ParentNode = document): void => {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>("collection-query[data-af-query]"));
  roots.forEach((root) => initCollectionQueryElement(root));
};
