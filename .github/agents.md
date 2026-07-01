# Copilot Agent Instructions

## Repository Context

`react-perf-hooks` is a single-package TypeScript library of React hooks for performance monitoring, profiling, and Core Web Vitals measurement.

The repository contains:

- `src/hooks/*` - library hooks and colocated Vitest tests.
- `src/index.ts` - the public package export surface.
- `docs/` - Docusaurus MDX documentation for each hook.
- `examples/stackblitz/` - runnable demos used by the docs.
- `tsup.config.ts` - package build config for CJS, ESM, and declaration output.

The package is TypeScript-first, tree-shakeable, and should keep runtime dependencies minimal. `web-vitals` is optional and must remain optional.

## Commands

Use pnpm. Important commands:

- `pnpm type-check` - TypeScript check for library sources.
- `pnpm lint` - ESLint check.
- `pnpm format:check` - Prettier check.
- `pnpm test:run` - Vitest test suite.
- `pnpm build` - tsup package build.
- `pnpm run ci` - full local CI. Do not use `pnpm ci`; pnpm treats that as its own command.

Run focused tests while developing, then run `pnpm run ci` before considering a change complete.

## Coding Standards

- Keep hooks small, focused, and exported from their own `src/hooks/<hookName>/index.ts`.
- Add or update the matching `*.test.tsx` file for behavior changes.
- Export new public hooks and types from `src/index.ts`.
- Use strict TypeScript. Avoid `any`; prefer explicit exported interfaces and return types for public APIs.
- Preserve React peer compatibility where practical. The peer dependency is `react >=16.8.0`.
- Avoid adding runtime dependencies. If a dependency is unavoidable, explain why it belongs in the package.
- Keep browser-only APIs guarded for SSR and jsdom tests, for example `typeof window !== 'undefined'`, `typeof PerformanceObserver !== 'undefined'`, or feature checks.
- Use cleanup functions for timers, observers, event listeners, animation frames, and subscriptions.
- Avoid module-level mutable state unless it is required and has a cleanup path.
- Keep generated build output in `dist/` out of source edits unless the task explicitly asks for release artifacts.

## React Hook Patterns

- Follow the Rules of Hooks: call hooks unconditionally and at the top level.
- The ESLint config uses `eslint-plugin-react-hooks` `recommended-latest`, which includes React Compiler-style purity checks.
- Do not read or mutate `ref.current` during render. Prefer state, memoized objects, effects, callbacks, or explicit instance maps with cleanup when a hook needs stable per-instance data.
- Do not call impure APIs such as `performance.now()` during render unless the existing lint config accepts the pattern.
- Prefer effects for side effects such as logging, warning, measuring after commit, observing browser APIs, and cleanup.
- When a hook intentionally works only in development, default `enabled` to `process.env.NODE_ENV !== 'production'` and keep production behavior cheap.

## Testing Guidance

- Tests use Vitest, Testing Library React, jsdom, and `src/test-setup.ts`.
- Mock browser performance APIs carefully and restore global state after each test.
- Cover disabled states, SSR/browser API absence, cleanup behavior, callbacks, and edge values for numeric options.
- Keep tests deterministic. Avoid relying on real timers or real PerformanceObserver delivery when fake timers or mocks are clearer.

## Documentation and Examples

- Public API changes should update the relevant file in `docs/hooks/*.mdx`.
- If usage changes, update README snippets and StackBlitz demos where applicable.
- Keep docs concise and practical. This library is for measuring React performance, not general React utilities.

## Build and Packaging

- `tsup` builds from `src/index.ts` into CJS, ESM, and `.d.ts` files.
- Keep `react`, `react-dom`, and `web-vitals` external.
- Do not minify package output; readability is intentional.
- Keep exports compatible with the package `exports` map in `package.json`.
