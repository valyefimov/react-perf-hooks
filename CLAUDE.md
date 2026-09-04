 # react-perf-hooks

TypeScript library of React hooks for performance monitoring: render tracking, Core Web Vitals,
memory/network/allocation profiling. Zero-dependency-first, tree-shakeable (`sideEffects: false`),
optional `web-vitals` peer. Ships CJS+ESM+d.ts via tsup. Docs site built with Docusaurus from `docs/*.mdx`.

Detailed engineering rules (commands, coding standards, hook patterns, testing, build) already live in
`.github/agents.md` — read it, it is authoritative and not duplicated here. This file adds naming
conventions, the skill workflow, and edit boundaries specific to agentic work in this repo.

## Naming conventions

- Hook name: `use<PascalCaseNoun>`, one hook per directory: `src/hooks/use<Name>/`.
- Files inside: `index.ts` (implementation + exports), `use<Name>.test.tsx` (colocated test).
- Options type: `Use<Name>Options`. Return type (when object, not primitive): `Use<Name>Return`.
  Other exported types: descriptive PascalCase, no hook-name prefix required (e.g. `RenderInfo`,
  `WebVitalMetric`).
- Every exported hook and its public types get re-exported from `src/index.ts`, grouped as one
  `export { ... }` + one `export type { ... }` pair per hook, appended in the order hooks were added
  (do not alphabetize or reshuffle existing entries).
- Docs file: `docs/hooks/use-<kebab-case>.mdx`, registered in `sidebars.ts` under the `Hooks` category,
  and one row added to the table in `README.md` under `## Hooks`.

## Test structure

- Runner: Vitest (`vitest.config.ts`, jsdom environment, setup file `src/test-setup.ts`).
- Renderer: `@testing-library/react` `renderHook`/`rerender`, not full component mounts, unless the
  hook is inherently tied to DOM nodes (e.g. `useIntersectionObserver`, `useCLS`).
- One `describe('use<Name>', ...)` per file. Standard coverage for a new hook:
  - default/enabled behavior on first render and across `rerender()`
  - the `enabled: false` / disabled path is a true no-op (no console output, no side effects)
  - production no-op: `process.env.NODE_ENV = 'production'` short-circuits even with `enabled: true`
    (restore `NODE_ENV` in `afterEach`)
  - cleanup: observers/timers/listeners are torn down on unmount (spy on the relevant global)
  - browser-API-absent path (SSR / jsdom lacking the API) degrades gracefully
- Mock `console.log`/`console.warn` with `vi.spyOn` in `beforeEach`, `vi.restoreAllMocks()` in
  `afterEach`. Prefer fake timers (`vi.useFakeTimers`) over real delays.
- Run focused tests during development (`pnpm test <pattern>`), full suite before done
  (`pnpm test:run`), full local CI before calling a change complete (`pnpm run ci`).

## Documentation style

- JSDoc on every exported hook function: one summary paragraph, then an `@example` with a realistic
  component snippet (see `useRenderCount/index.ts` for the target shape). Document non-obvious
  behavior (Strict Mode double-counting, SSR guards) as prose above the function, not inline comments.
- JSDoc on every option field in the `Use<Name>Options` interface: one line, stating the default value
  in the comment when the field is optional.
- No comments explaining *what* code does; comments only for *why* (a workaround, an invariant, a
  rejected alternative) — matches the existing style in `useRenderCount/index.ts`.
- `docs/hooks/use-<kebab-case>.mdx` follows the fixed section order: `Description and use case` →
  `API signature` → `Parameters` (with an `Options` sub-table) → `Return value` → any hook-specific
  behavior notes → `Code example` → `Companion article` placeholder links. Copy an existing file as the
  template rather than free-forming the structure.

## Edit boundaries — do not touch without an explicit user request

- `package.json`: version field, `release:*` scripts, dependency version bumps. Adding a new
  `optionalDependency` for a hook needs explicit sign-off (the library is optional-dependency-averse
  by design, see `.github/agents.md`).
- `dist/` and `build/` — generated output, never hand-edited.
- `.github/workflows/*.yml`, `.github/dependabot.yml` — CI config.
- `pnpm-lock.yaml` — only regenerate as a side effect of an approved `package.json` change.
- `docusaurus.config.ts`, `sidebars.ts` structural changes beyond appending one new hook entry.
- Anything under `graphify-out/` — regenerate via `graphify update .`, never hand-edit.
- Git: never `push`, `push --force`, or delete branches without explicit request (also enforced in
  `.claude/settings.json`).

## Filing issues / proposing features

See `.claude/skills/new-hook/SKILL.md` for adding a hook, and the "Filing issues" section below for
bug reports / feature proposals discovered during work.

When you find a bug or think of a feature while working and no GitHub MCP tool is connected, do not
guess an issue URL or fabricate one — report the finding in chat with a short title, repro/rationale,
and suggested fix, and let the user decide whether to file it. If a GitHub MCP tool *is* connected, you
may draft the issue body but must confirm with the user before creating it (issue creation is
GitHub-visible and irreversible in the sense that it notifies watchers) — there is no repo issue
template, so use this shape:

```
### Summary
one paragraph

### Repro / evidence  (bugs only)
minimal steps or failing test

### Proposed approach  (features only)
one paragraph, referencing the hook naming/testing conventions above

### Affected hook(s)
useX, useY (or "new hook")
```
