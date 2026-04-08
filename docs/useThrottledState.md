# useThrottledState

A throttled alternative to `useState` for high-frequency updates such as scroll position, mouse coordinates, or drag state. It also tracks how many incoming updates were dropped before they could commit.

## Why use it?

Pointer, scroll, and resize events can fire dozens of times per second. Throttling keeps UI updates bounded while still exposing the latest meaningful value. This hook gives you:

- A `useState`-style setter with configurable `leading` and `trailing` throttle behavior
- Profiling stats for each hook instance (`droppedUpdates`, `totalUpdates`)
- Safe unmount cleanup for the pending throttle timer

---

## Import

```ts
import { useThrottledState } from 'react-perf-hooks';
```

---

## Signature

```ts
function useThrottledState<T>(
  initialState: T | (() => T),
  interval?: number,
  options?: UseThrottledStateOptions
): [T, Dispatch<SetStateAction<T>>, ThrottledStateStats]
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialState` | `T \| (() => T)` | — | Initial value (or lazy initializer), same as `useState` |
| `interval` | `number` | `100` | Throttle window in ms. `0` or negative values apply updates immediately |
| `options` | `UseThrottledStateOptions` | `{ leading: true, trailing: true }` | Choose whether to commit on the first call in a window, the last call in a window, or both |

### `UseThrottledStateOptions`

```ts
interface UseThrottledStateOptions {
  leading?: boolean;
  trailing?: boolean;
}
```

- `leading: true`: commit the first update in a throttle window immediately
- `trailing: true`: commit the latest queued update when the window closes
- At least one edge must be enabled

---

## Return value

| Position | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current committed state value |
| `setValue` | `Dispatch<SetStateAction<T>>` | Throttled setter. Accepts both direct values and updater functions (`prev => next`) |
| `stats` | `ThrottledStateStats` | Profiling counters for this hook instance |

### `ThrottledStateStats`

```ts
interface ThrottledStateStats {
  droppedUpdates: number;
  totalUpdates: number;
}
```

- `totalUpdates`: increments on every `setValue(...)` call
- `droppedUpdates`: increments whenever an in-window update is replaced or discarded before it can commit

---

## Demo

See: [`docs/demos/useThrottledStateDemo.tsx`](./demos/useThrottledStateDemo.tsx)

```tsx
import { useThrottledState } from 'react-perf-hooks';

function PointerDemo() {
  const [point, setPoint, stats] = useThrottledState(
    { x: 0, y: 0 },
    120,
    { leading: true, trailing: true }
  );

  return (
    <div
      onPointerMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
    >
      <p>
        Committed pointer: {point.x}, {point.y}
      </p>
      <p>Total updates: {stats.totalUpdates}</p>
      <p>Dropped updates: {stats.droppedUpdates}</p>
    </div>
  );
}
```

---

## Notes

- `leading: true, trailing: true` is the default and usually the best fit for responsive UI plus bounded renders.
- When `trailing` is disabled, suppressed updates are counted in `droppedUpdates` and the stats snapshot is flushed when the current window ends.
- Functional updates are resolved against the latest queued value, preserving expected updater semantics during bursts.
- Pending throttle timers are cleared on unmount.
