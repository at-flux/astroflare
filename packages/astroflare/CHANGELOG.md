# @at-flux/astroflare [2.0.0](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.17...@at-flux/astroflare@2.0.0) (2026-09-09)


### Bug Fixes

* **a11y:** name the collection controls, and lay them out without Tailwind ([735af34](https://github.com/at-flux/astroflare/commit/735af34dc7401300fd9ecf6679de0bd13c39545f))
* **a11y:** warn in dev when a modal has no accessible name ([c560867](https://github.com/at-flux/astroflare/commit/c560867fd7be6edaa34a233e7d80e62ff30dcbef))
* **forms:** submit the query controls so the submit event fires ([bf8e63a](https://github.com/at-flux/astroflare/commit/bf8e63a8577b408e7cd8ca79c1737cfcb938b247))
* **live-region:** keep the reader's place through back and forward ([cb1a9dd](https://github.com/at-flux/astroflare/commit/cb1a9ddcb7134fcc6e6fc31181ca52b23244d4c4))
* **styleguide:** drop the spinner trigger that could not put it away ([86a029b](https://github.com/at-flux/astroflare/commit/86a029b848b6cdc04dea1ce52aa7d0c8b8a0ec91))
* **styleguide:** stop the server paging demo flashing, and unclash its params ([05253fb](https://github.com/at-flux/astroflare/commit/05253fb92338c571c059818f4a294745f534172f))


* feat(suspense)!: remove ImageSuspense, ImageFade and LazyContent ([917aeff](https://github.com/at-flux/astroflare/commit/917aeffa3a6aa3e2e8caae6d875c267de146d70d))


### Features

* **clock:** read "now" through one place so it can be pinned ([c2e29a1](https://github.com/at-flux/astroflare/commit/c2e29a196aa2ccdd241b0cc07c255027bc16ea32))
* **headers:** add the section header block and its emoji medallion ([3338d03](https://github.com/at-flux/astroflare/commit/3338d037cff0dfea2bfc61f82c5ad13359089da2))
* **live-region:** swap URL-driven markup in place instead of navigating ([2537372](https://github.com/at-flux/astroflare/commit/2537372fb8452ec2f9b8387ea4f4d126386c1c8c))
* **modal:** expose the shell and panel classes ([d8b6edf](https://github.com/at-flux/astroflare/commit/d8b6edf4db209b46db475f106bd0c380f08dc19a))
* **paged-grid:** page a gallery without the grid changing shape ([1e4d523](https://github.com/at-flux/astroflare/commit/1e4d523f8acb8a6e8c244b4f1ab5972f04fc167e))
* **suspense:** deprecate the preset components Suspense replaced ([a6cc53b](https://github.com/at-flux/astroflare/commit/a6cc53b5f9eb52d6e3d20d11c3acfcc2cb1cac9a))
* **suspense:** unify image and lazy-content loading behind one primitive ([5c84207](https://github.com/at-flux/astroflare/commit/5c84207fd87342c531459b2b6dabb356d08c92f4))
* **theme:** stamp the theme before first paint ([5110918](https://github.com/at-flux/astroflare/commit/51109183bd3af7b76f57d86763ffa81011b0b481))


### BREAKING CHANGES

* `components/ImageSuspense.astro`, `components/ImageFade.astro`
and `components/LazyContent.astro` are gone. Use `components/Suspense.astro`:
`<ImageSuspense …>` becomes `<Suspense frame …>` with `spinnerColor` renamed to
`accent`, and `<LazyContent src=… >` becomes
`<Suspense src=… when="dialog-open" minHeight="12rem">` with `when="immediate"`
renamed to `when="eager"` and the `loading` slot renamed to `placeholder`.
`LazyContent`'s default spinner and error line were markup rather than
behaviour, so copy them into the `placeholder` and `error` slots to keep them.

Claude-Session: https://claude.ai/code/session_018J4mRpiApegWgBBdtmJ2uW

## @at-flux/astroflare [1.0.17](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.16...@at-flux/astroflare@1.0.17) (2026-07-30)


### Bug Fixes

* **modal:** restore backdrop and remove double scrollbar ([a254cf8](https://github.com/at-flux/astroflare/commit/a254cf887990ff756209397c1e6345d8835fe15d))


### Features

* add LazyContent fetch-on-demand component ([6ca7193](https://github.com/at-flux/astroflare/commit/6ca7193336478374939d6848ec3c9381c614d3c6))
* add shared ConfirmationSection component ([35b69a9](https://github.com/at-flux/astroflare/commit/35b69a9e97550913ea0124361778710d8ff845df))
* add ShareLinks component with tests ([f61b7ff](https://github.com/at-flux/astroflare/commit/f61b7ff54bad29073207e90457854989c9d4c96a))
* **deps:** migrate to Astro 7, Vite 8, Vitest 4, TypeScript 7 ([8b8626d](https://github.com/at-flux/astroflare/commit/8b8626dff2d6f593095875e290bb02c90f7cc44a))
* **form-field:** add radio type and rich help text ([f21a82c](https://github.com/at-flux/astroflare/commit/f21a82c0ac046412e7c53f172f7dcab041766e54))
* **styles:** ship Tailwind [@source](https://github.com/source) registration for consumers ([6ed277d](https://github.com/at-flux/astroflare/commit/6ed277dad05c0700190c774f643adc5b04e974d0))

## @at-flux/astroflare [1.0.16](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.15...@at-flux/astroflare@1.0.16) (2026-07-28)

### Bug Fixes

- **forms:** make form primitive base styles fully overridable ([f597a32](https://github.com/at-flux/astroflare/commit/f597a32907a046a7b2621245b6356c94eeaad86f))
- **spinner:** bind ClientRouter listeners once ([a593ed3](https://github.com/at-flux/astroflare/commit/a593ed37e0f1560617de507c960919c59091280e))

## @at-flux/astroflare [1.0.15](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.14...@at-flux/astroflare@1.0.15) (2026-07-27)

### Features

- **action-form:** gate submit on native validity + stamp timestamps ([535c5b8](https://github.com/at-flux/astroflare/commit/535c5b82179458868631d1d66105668fa42160c4))
- **forms:** generic form field/layout primitives ([67ff494](https://github.com/at-flux/astroflare/commit/67ff49422c739ed5724af356e49e2d12f696a734))
- **forms:** shared Astro Action form submit runtime ([3dce1d9](https://github.com/at-flux/astroflare/commit/3dce1d93f2f2c4b4a95aa339ae397faa7fa9106e))
- **modal:** accessible name + real button trigger ([c66c1d9](https://github.com/at-flux/astroflare/commit/c66c1d99e771978c610f923a58fa30cfc7e9a7fb))

## @at-flux/astroflare [1.0.14](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.13...@at-flux/astroflare@1.0.14) (2026-07-21)

### Features

- **astroflare:** extract LoadingSpinner and use it as the default indicator ([e5795e2](https://github.com/at-flux/astroflare/commit/e5795e2c56fd5b9dde7e272e4324eed6cee7ae7f))

## @at-flux/astroflare [1.0.12](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.11...@at-flux/astroflare@1.0.12) (2026-07-21)

### Bug Fixes

- **astroflare:** make ImageFade spinner rotate and add overridable background ([a59ed96](https://github.com/at-flux/astroflare/commit/a59ed962fa747a9170ebd2fd207ceb8fc62f2ff7))

## @at-flux/astroflare [1.0.11](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.10...@at-flux/astroflare@1.0.11) (2026-07-21)

### Bug Fixes

- **astroflare:** stop ImageFade overriding slotted image object-fit ([8211498](https://github.com/at-flux/astroflare/commit/821149807506ff4bc02fe53db011c5650472ce13))

## @at-flux/astroflare [1.0.10](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.9...@at-flux/astroflare@1.0.10) (2026-07-17)

### Features

- **astroflare:** add ImageFade image loading wrapper ([fef77cf](https://github.com/at-flux/astroflare/commit/fef77cfb9712f064a3f8a60935558c5cc6be6d28))

## @at-flux/astroflare [1.0.9](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.8...@at-flux/astroflare@1.0.9) (2026-05-20)

### Features

- **collection-filters:** add sticky query controls and date-range composition ([198a1ae](https://github.com/at-flux/astroflare/commit/198a1ae0d2388bf06977155474b9c1ede1e7d918))

## @at-flux/astroflare [1.0.8](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.7...@at-flux/astroflare@1.0.8) (2026-04-26)

### Features

- **collection-filters:** comma labels, empty-state lock, and typed totalItems ([6d4e551](https://github.com/at-flux/astroflare/commit/6d4e551d1d33a467971e5e368f994c2decc887d2))

## @at-flux/astroflare [1.0.7](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.6...@at-flux/astroflare@1.0.7) (2026-04-26)

### Bug Fixes

- **collection-query:** reconcile offset with page; href from page+size ([9968830](https://github.com/at-flux/astroflare/commit/9968830ef9b317e8f9257bf5c7785d6f3c0a9d8b))
- **collection-query:** support multi-tag filters and stable island refresh ([7956cbf](https://github.com/at-flux/astroflare/commit/7956cbf09f642ffb9d7da32cfdc5e4a77fd90cb7))
- **collection-ui:** normalize filters, strengthen active pills, center pager row ([1f24192](https://github.com/at-flux/astroflare/commit/1f24192b7bc6dc91ece57c466946303529992d32))

### Features

- CollectionFooterControls and resolveIslandSearchString ([495788a](https://github.com/at-flux/astroflare/commit/495788abff9104bc21f52f122c48af0d3ef08b0a))

## @at-flux/astroflare [1.0.6](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.5...@at-flux/astroflare@1.0.6) (2026-04-24)

### Bug Fixes

- **astroflare:** add server page-size control and disable active pager links ([242892f](https://github.com/at-flux/astroflare/commit/242892f5fc13bd56116bc3dfc9c4ddbadf4b4c41))

## @at-flux/astroflare [1.0.5](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.4...@at-flux/astroflare@1.0.5) (2026-04-24)

### Bug Fixes

- **astroflare:** include src utility modules in package files ([8640d70](https://github.com/at-flux/astroflare/commit/8640d7079d8515c3c3af50a67612b1fc62125b68))

## @at-flux/astroflare [1.0.4](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.3...@at-flux/astroflare@1.0.4) (2026-04-23)

### Bug Fixes

- **styleguide:** improve tooltip anchor and control demos ([9b526d3](https://github.com/at-flux/astroflare/commit/9b526d3a46f672c19b22caae347d3530fe75a629))
- **styleguide:** reduce server paging flicker in collection demo ([b95fcba](https://github.com/at-flux/astroflare/commit/b95fcba5c1f21da6a89c05fbb4b91c36867cda05))
- **styleguide:** smooth server query transitions and collapse result cards ([484468f](https://github.com/at-flux/astroflare/commit/484468f72b5479b79e998d39de70176002cfe966))

### Features

- **astroflare:** add collection query and date utilities ([54d053b](https://github.com/at-flux/astroflare/commit/54d053bd0ba62e566f2abe8e2ce8db94aad4a1ab))
- **astroflare:** add media protection wrapper runtime ([db1bce3](https://github.com/at-flux/astroflare/commit/db1bce37c7cc7d139dc884639bdc0aa4a44373fb))
- **astroflare:** add package styleguide and integration docs ([26886e2](https://github.com/at-flux/astroflare/commit/26886e2061967dea370a8e9c9edac3673e2aef62))
- **astroflare:** add reusable filter and pager controls ([4bed35f](https://github.com/at-flux/astroflare/commit/4bed35f471ed7de2bbe97d61c19518b4002024d5))
- **astroflare:** add summary and tag-color primitives ([e159976](https://github.com/at-flux/astroflare/commit/e159976a4624f099fb34c14008d07ddd34759e09))
- **astroflare:** add unified collection query component runtime ([2b7df74](https://github.com/at-flux/astroflare/commit/2b7df74c2d61b33cc42be5de47e7ff8d67b37179))

## @at-flux/astroflare [1.0.3](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.2...@at-flux/astroflare@1.0.3) (2026-04-02)

### Bug Fixes

- **ci:** verify release tags against origin/main for workflow_run reruns ([af65449](https://github.com/at-flux/astroflare/commit/af654490daf3b7a949ddbeb17288a5d90301da38))

## @at-flux/astroflare [1.0.2](https://github.com/at-flux/astroflare/compare/@at-flux/astroflare@1.0.1...@at-flux/astroflare@1.0.2) (2026-03-29)

### Features

- **components:** add ContactModalCta and InstagramProfileLink ([c31d9f7](https://github.com/at-flux/astroflare/commit/c31d9f7ece91724e8369856168aea80d94ac9fcb))

# @at-flux/astroflare 1.0.0 (2026-03-26)

### Bug Fixes

- **publish:** use npm OIDC trusted publishing; normalize package.json ([71aa687](https://github.com/at-flux/astroflare/commit/71aa68755d225259ec8f443749df94bd9a701b86))
- **publish:** use npm OIDC trusted publishing; normalize package.json ([a17b7be](https://github.com/at-flux/astroflare/commit/a17b7be9ac0879ca1dd38f7a524aea664adb44c9))

### Features

- **core:** add opinionated astroflare core/forms/dom subpaths ([8500870](https://github.com/at-flux/astroflare/commit/85008706a8579679f4e029cd9924fbd064915a2d))
- remove @at-flux/astroflare/dom; publish @at-flux/dom standalone ([02531fe](https://github.com/at-flux/astroflare/commit/02531feaef4d053e75ab1a6fe0ce51134374845f))
