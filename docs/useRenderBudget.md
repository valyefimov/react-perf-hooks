# useRenderBudget

Measures the time from **render start to commit** and warns when a component exceeds a render-time budget.

Default budget is **16ms** (one 60fps frame).

## Why use it?

Render performance regressions often slip in gradually. `useRenderBudget` gives immediate feedback in development so slow components are caught close to where they were introduced.

- Measures each commit with `performance.now()`
- Warns with component name, actual time, and budget
- Supports strict mode to throw instead of warn
- Automatically disabled in production by default

---

## Import

```ts
import { useRenderBudget } from 'react-perf-hooks';
```

---

## Signature

```ts
function useRenderBudget(
  budgetMs?: number,
  componentName?: string,
  options?: UseRenderBudgetOptions
): void
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `budgetMs` | `number` | `16` | Max allowed render-to-commit duration in milliseconds |
| `componentName` | `string` | `"Component"` | Label included in warnings/errors |
| `options.enabled` | `boolean` | `true` in dev / `false` in prod | Set to `true` to force-enable in production debugging |
| `options.strict` | `boolean` | `false` | Throw an error instead of calling `console.warn` |

---

## Console output

When a commit exceeds budget:

```text
⚠️ [useRenderBudget] MyComponent exceeded budget: 34ms (budget: 16ms)
```

---

## Examples

### Basic usage

```tsx
import { useRenderBudget } from 'react-perf-hooks';

function SearchResults({ items }: { items: string[] }) {
  useRenderBudget(16, 'SearchResults');
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}
```

### Strict mode (throw)

```tsx
function ExpensiveChart(props: Props) {
  useRenderBudget(12, 'ExpensiveChart', { strict: true });
  return <canvas />;
}
```

### Force-enable in production debug builds

```tsx
const debugPerf = process.env.NEXT_PUBLIC_PERF_DEBUG === 'true';

function App() {
  useRenderBudget(16, 'App', { enabled: debugPerf });
  return <main>...</main>;
}
```

---

## Notes

- Measurement happens on every commit while enabled.
- In React Strict Mode (development), components can render/commit more than once for intentional checks.
- Passing an invalid `budgetMs` (e.g. `0`, negative, `NaN`) falls back to `16ms`.

---

## TypeScript

```ts
interface UseRenderBudgetOptions {
  enabled?: boolean;
  strict?: boolean;
}
```
