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

## Slow tests (production example build)

`test/build-output.test.ts` runs `pnpm --dir example build` and asserts:

- Routes gated by **disabled** flags are **not** present under `example/dist/` after `astro build` (pruning).
- Markup wrapped in `shouldRenderFeature(...)` for a flag that is off in production **does not** appear in emitted HTML (SSR/build-time gating).

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
