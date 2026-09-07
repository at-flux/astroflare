# Component preview options for an Astro component library

Researched 2026-09-07. Every version, date and size below was measured, not
recalled: release data comes from the npm registry API
(`https://registry.npmjs.org/<pkg>`), commit and repo data from the GitHub API,
and install weight from `npm install <pkg>` into an empty project on Linux,
measured with `du -sh node_modules`. Anything I could not check is called out at
the end.

## The question

This package ships `.astro` components whose behaviour is almost entirely
client-side: `Suspense` and its two presets are custom elements driven by
timers, `IntersectionObserver` and `fetch`. A preview tool is only useful here
if it (a) renders `.astro` natively, (b) runs the component's own
`<script>` in the browser, and (c) can serve slow/failing routes so the loading
states are reachable at all.

## Summary

| Tool                                           | Latest release           | Last commit | Renders `.astro` natively  | Install weight (empty project)                 |
| ---------------------------------------------- | ------------------------ | ----------- | -------------------------- | ---------------------------------------------- |
| Hand-rolled Astro pages (`styleguide/`)        | n/a                      | n/a         | Yes — it _is_ Astro        | 0 new dependencies                             |
| Astrobook                                      | 0.13.3, 2026-08-14       | 2026-08-19  | Yes                        | 3.3 MB, 9 packages                             |
| storybook-astro (`@storybook-astro/framework`) | 1.11.0, 2026-08-27       | active      | Yes, via the Container API | 202 MB, 195 packages (with `storybook` 10.6.0) |
| Storybook itself                               | 10.6.0, 2026-09-02       | daily       | No Astro framework exists  | as above                                       |
| Histoire                                       | 1.0.0-beta.1, 2026-01-07 | 2026-06-14  | No (Vue / Svelte only)     | 90 MB, 147 packages                            |
| Ladle                                          | 5.1.1, 2025-11-04        | 2026-06-28  | No (React only)            | 128 MB, 325 packages                           |

## Astrobook

`astrobook@0.13.3`, published 2026-08-14, MIT, 48 versions since 2024-08.
Repo `ocavue/astrobook`, 279 stars, not archived, 15 open issues, last pushed
2026-09-04, last commit on master 2026-08-19. Single maintainer.

It is an **Astro integration**, not a separate app: you add `astrobook()` to
`astro.config.mjs` and it mounts a story browser on the dev server, optionally
under a `subpath` inside an existing Astro project. Because of that its
dependency footprint is tiny — three of its own scoped packages plus `acorn`,
`fdir`, `picomatch`, `slash`, `valibot`, `yoctocolors`; 3.3 MB and 9 packages
installed here, and it takes `astro >= 5.0.0` as a peer, which this repo already
has.

Stories are `.stories.{ts,tsx,js,jsx,mts,mjs}` modules in a documented subset of
Storybook CSF3 — a default export with `component`, named exports with `args`
and `decorators`. `.astro` components are first-class: the repo's own
`examples/playground/src/components/astro/AstroCounter.stories.ts` imports
`AstroCounter.astro`, types args with `ComponentProps<typeof AstroCounter>`,
and the component's inline `<script>` custom element works in the preview.

Limits worth knowing for this library:

- Stories pass **props, not slot content**. A component whose whole point is
  wrapping arbitrary children (`Suspense`) can only be given children through a
  `decorator`, which wraps _outside_ the component, not inside its default slot.
  Every `Suspense` demo would need a purpose-built wrapper `.astro` per case.
- Decorators are documented as styling-only: "not able to change a component's
  context or any client-side behaviors".
- No server routes. The slow-image endpoint and the deliberately-404 fragment
  route that make the loading and error states visible have no home in a story
  file; they would have to live in a separate Astro app anyway.
- Still 0.x, one maintainer.

## storybook-astro (community framework)

Not the official Storybook project. Storybook's own framework list
(`storybook.js.org/docs/get-started/frameworks`) has **no Astro entry**, in
either the official or the community-maintained section.

There are three separate community attempts, which is itself a signal:

- `@storybook-astro/framework` (`storybook-astro/storybook-astro`,
  storybook-astro.org) — the live one. 1.11.0 published 2026-08-27, first
  published 2026-02-16, 56 versions in ~6 months. MIT.
- `storybook-astro` (`thinkoodle/storybook-astro`) — 0.2.1, 2026-04-24, three
  versions total.
- `slawekkolodziej/storybook-astro` — described by its own author as
  experimental.

The live one renders `.astro` server-side through Astro's **Container API** via
Vite middleware, injects the HTML into the Storybook canvas, and its docs state
that client-side scripts are then re-executed for interactivity — so custom
elements should work in dev. Slots are supported, both as strings and as
components. Its documented limitations matter here though: in **static builds**
components are pre-rendered with default args and the Controls panel is
disabled, and the docs say client-side behaviour needs end-to-end testing
because the Container API does not execute scripts during that pre-render.

Weight is the real objection. `storybook@10.6.0` plus the framework installed to
**202 MB across 195 packages** in an empty project, and that is before its long
peer list (`@astrojs/*` integrations, `@vitejs/plugin-*`, `@storybook/react`,
`@storybook/vue3`, …). For a three-package library whose entire published
surface is 19.57 kB, that is a preview tool an order of magnitude larger than
the thing it previews.

## Histoire

`histoire@1.0.0-beta.1`, published 2026-01-07 — the 1.0 line has been in beta
since then and no stable 1.0 has shipped. Repo moved from `Akryum/histoire` to
`histoire-dev/histoire`; 3,572 stars, not archived, 203 open issues, last commit
2026-06-14 and the two before it 2026-04-01 and 2026-03-28. Alive but slow.

It is **Vue-first**, with Svelte support (Svelte 5 landed 2026-03) and a Nuxt
plugin; its CI matrix is Vue 3, Svelte 4, SvelteKit and Nuxt 4. There is no
Astro renderer, and `.astro` files are not rendered. 29 direct dependencies,
90 MB / 147 packages installed, peer `vite ^7.3.0`. Ruled out on capability, not
on weight.

## Ladle

`@ladle/react@5.1.1`, published 2025-11-04. Repo `tajo/ladle`, 2,981 stars, not
archived, last commit 2026-06-28. Healthy, but it is **React only** — peers are
`react`/`react-dom` >= 18, and 38 direct dependencies including Babel, MSW and
MDX pull in 128 MB / 325 packages. It cannot render an `.astro` file at all.
Ruled out on capability.

## Hand-rolled Astro pages

This is what `packages/astroflare/styleguide/` already is: a small Astro app
with the node adapter, run with `astro dev --root styleguide`, importing the
components straight from `../../src/components/*.astro`.

- Zero new dependencies. Astro is already a devDependency; the styleguide is
  excluded from the published package by the `files` list.
- Renders `.astro` exactly as production does, including scoped styles,
  `is:global`, `is:inline` and `<noscript>` handling, and component `<script>`
  bundling.
- Slots, named slots and nested components are just markup, so a wrapper
  component's real API can be demonstrated.
- It can serve the routes a suspense demo needs: `/api/slow-image.svg?delay=`
  and `/fragments/slow/?delay=` are ordinary Astro endpoints, and a 404 for the
  error state costs nothing.
- Sections are plain `<section id="…">`, so every demo is linkable
  (`/suspense#grace`) and curl-checkable in CI.
- What you give up: no args/controls panel, no auto-generated props table, no
  story isolation per iframe, and the nav is hand-maintained (one shared
  `nav.ts` here).

## Recommendation

**Keep the hand-rolled styleguide as the primary preview.** For a library this
size the only thing a story runner adds is a controls panel, and it charges
between 90 MB and 202 MB of dependencies for it, while the components that most
need previewing — the suspense family — are defined by slot content, real
network timing and client-side scripts, which are exactly the things stories
model worst and an ordinary Astro route models perfectly.

**If a props matrix is later wanted, add Astrobook, not Storybook.** It is the
only option in this list that is both actively released (0.13.3, 2026-08-14) and
cheap (3.3 MB, 9 packages), it is an Astro integration so it can mount under a
`subpath` of the existing styleguide rather than replacing it, and stories are
plain TS modules that can sit next to the components. Treat it as an addition
for prop-driven leaf components (buttons, badges, tags), and keep the
narrative pages for anything whose behaviour is timing- or slot-shaped.

**Do not adopt Histoire or Ladle**: neither renders `.astro` at all.
`@storybook-astro/framework` is genuinely capable and actively developed, but it
is community-maintained with two abandoned rivals of the same name, and it is
only worth its size if the project is already standardised on Storybook.

## Not verified

- I did not install Astrobook or `@storybook-astro/framework` into this repo, so
  I have not seen either render this package's `Suspense` component. The claims
  about slot handling, Container API script re-execution and static-build
  limitations come from each project's own docs and example sources, not from a
  running preview.
- Install sizes are `npm install` into an empty project on this machine. pnpm's
  content-addressed store makes real disk cost lower in this workspace, and the
  Storybook figure excludes its unmet peer dependencies, so it is an
  underestimate of a working setup.
- Package counts are `find node_modules -maxdepth 2 -name package.json | wc -l`,
  which counts scoped packages correctly but is a proxy, not npm's own count.
- "Last commit" is the newest commit on the default branch at the time of
  writing; a repo can be maintained on release branches without that moving.
- Astrobook's maintenance is judged from public repo activity only. I have no
  information about its bus factor beyond it being one person's project.
