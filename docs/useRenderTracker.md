# useRenderTracker

Tracks how many times a component renders and logs **which props changed** between renders. Optionally emits a `console.warn` when a configurable render-count threshold is exceeded.

## Why use it?

Unnecessary re-renders are one of the most common React performance problems. This hook gives you:

- A live render counter directly in the component
- Automatic prop-diffing with `Object.is` — no manual `prev/next` refs needed
- A safety net (`warnAt`) that alerts you before a hot component becomes a bottleneck

It is disabled automatically in production so you never ship debug output.

---

## Import

```ts
import { useRenderTracker } from 'react-perf-hooks';
```

---

## Signature

```ts
function useRenderTracker(
  props?: Record<string, unknown>,
  options?: UseRenderTrackerOptions
): RenderInfo
```

---

## Parameters

### `props` _(optional)_

```ts
props?: Record<string, unknown>
```

Pass the props (or any object whose keys you want to watch) to enable prop-change diffing. On each re-render the hook compares every key with `Object.is` and logs changed keys to the console.

If omitted, the hook still counts renders and can still warn at the threshold — it just skips the prop-change log.

### `options` _(optional)_

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `"Component"` | Label used in console messages |
| `enabled` | `boolean` | `true` in dev / `false` in prod | Set `false` to disable tracking entirely |
| `warnAt` | `number` | — | Call `console.warn` when render count reaches this number |

---

## Return value — `RenderInfo`

| Field | Type | Description |
|-------|------|-------------|
| `count` | `number` | Total render count. `0` when `enabled` is false |
| `lastRenderTime` | `number` | `performance.now()` timestamp of the latest render. `0` when disabled |

---

## Console output

**Re-render with changed props:**
```
[useRenderTracker] "UserList" re-rendered (×4). Changed props: ["filters", "page"]
```

**Re-render with no prop change (parent caused it or internal state/context update):**
```
[useRenderTracker] "UserList" re-rendered (×5). No prop changes detected (parent re-render or context/state update).
```

**Threshold warning:**
```
[useRenderTracker] "UserList" has rendered 10 times! Consider wrapping it in React.memo() or optimising its dependencies.
```

---

## Examples

### Basic — render counter

```tsx
import { useRenderTracker } from 'react-perf-hooks';

function Badge({ label }: { label: string }) {
  const { count } = useRenderTracker();

  return (
    <span>
      {label}
      {process.env.NODE_ENV === 'development' && ` [renders: ${count}]`}
    </span>
  );
}
```

### Prop-change diffing

```tsx
import { useRenderTracker } from 'react-perf-hooks';

interface Props {
  userId: string;
  filters: Record<string, string>;
  onSelect: (id: string) => void;
}

function UserTable({ userId, filters, onSelect }: Props) {
  // Pass exactly the props you want to watch
  useRenderTracker(
    { userId, filters, onSelect },
    { name: 'UserTable' }
  );

  return <table>...</table>;
}
```

> **Tip:** Passing `onSelect` to the watcher helps you spot when a parent is accidentally creating a new function reference on every render — a common cause of unnecessary re-renders.

### Warn at threshold

```tsx
import { useRenderTracker } from 'react-perf-hooks';

function ExpensiveChart({ data, config }: Props) {
  useRenderTracker(
    { data, config },
    { name: 'ExpensiveChart', warnAt: 5 }
  );

  // This chart takes ~50 ms to render — we really don't want it to
  // re-render more than 5 times during a user session.
  return <canvas ref={canvasRef} />;
}
```

### Force-enable in a staging environment

```tsx
const isProdDebug =
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_PERF_DEBUG === 'true';

function App() {
  useRenderTracker(undefined, { name: 'App', enabled: isProdDebug });
  return <Router />;
}
```

### Read render count in tests (Vitest)

```tsx
import { renderHook } from '@testing-library/react';
import { useRenderTracker } from 'react-perf-hooks';

it('tracks render count', () => {
  const { result, rerender } = renderHook(() =>
    useRenderTracker(undefined, { enabled: true })
  );

  rerender();
  rerender();

  expect(result.current.count).toBe(3);
});
```

---

## How it works

The render count is stored in a `useRef` and incremented **during the render phase** (not in an effect). This means the value returned is always accurate for the current render — there is no one-render lag.

Prop diffing also happens during the render phase. The previous props snapshot is stored in a separate `useRef`.

---

## Performance impact

The hook adds a negligible constant overhead per render:

- One `useRef` read + increment
- One `performance.now()` call
- One shallow object comparison (one `Object.is` per watched key)

When `enabled` is `false` the body is skipped entirely.

---

## TypeScript interfaces

```ts
interface RenderInfo {
  count: number;
  lastRenderTime: number;
}

interface UseRenderTrackerOptions {
  name?: string;
  enabled?: boolean;
  warnAt?: number;
}
```
