# Testing `@at-flux/astro-feature-flags`

## Unit and integration tests

From the package directory:

```bash
pnpm test
pnpm typecheck
```

From the monorepo root:

```bash
pnpm --filter @at-flux/astro-feature-flags test
pnpm --filter @at-flux/astro-feature-flags exec tsc --noEmit
```

## Slow tests (production builds)

`test/build-output.test.ts` runs real Astro production builds and asserts:

- **Route pruning:** `pnpm --dir example build` — routes gated by disabled flags are absent under `example/dist/`.
- **SSR / build-time + declarative gating:** fixture `test/fixtures/ssr-gate-site/` imports `featureFlagStyles` (empty in production). With `hotFeature2` off in prod: **`shouldRenderFeature('hotFeature2')` markup is absent** (compile-time). **`data-ff-*` gated nodes are removed** from emitted static HTML by the integration’s post-build pass (no production gate CSS).

These checks are **off by default** in CI because they shell out to a full Astro production build.

Enable locally or in a dedicated job:

```bash
ENABLE_SLOW=1 pnpm exec vitest run test/build-output.test.ts
```

Or from the monorepo root:

```bash
cd packages/astro-feature-flags && ENABLE_SLOW=1 pnpm test
```

Set `ENABLE_SLOW=1` in GitHub Actions (or equivalent) when you want this gate on every PR.
