# useDebouncedState

A drop-in alternative to `useState` that debounces updates and tracks how many renders were avoided by replacing pending updates.

## Why use it?

Typing, sliders, and search filters often fire many state updates in a burst. Debouncing those updates is common, but it's usually hard to quantify the benefit. This hook gives you:

- Debounced state updates with a familiar `useState` setter API
- Profiling stats for each hook instance (`skippedRenders`, `totalUpdates`)
- Safe unmount cleanup (pending debounce timer is canceled automatically)

---

## Import

```ts
import { useDebouncedState } from 'react-perf-hooks';
```

---

## Signature

```ts
function useDebouncedState<T>(
  initialState: T | (() => T),
  delay?: number
): [T, Dispatch<SetStateAction<T>>, DebouncedStateStats]
```

---

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `initialState` | `T \| (() => T)` | — | Initial value (or lazy initializer), same as `useState` |
| `delay` | `number` | `300` | Debounce delay in ms. `0` or negative values apply updates immediately |

---

## Return value

| Position | Type | Description |
|----------|------|-------------|
| `value` | `T` | Current committed state value |
| `setValue` | `Dispatch<SetStateAction<T>>` | Debounced setter. Accepts both direct values and updater functions (`prev => next`) |
| `stats` | `DebouncedStateStats` | Profiling counters for this hook instance |

### `DebouncedStateStats`

```ts
interface DebouncedStateStats {
  skippedRenders: number;
  totalUpdates: number;
}
```

- `totalUpdates`: increments on every `setValue(...)` call
- `skippedRenders`: increments whenever a pending debounced update is replaced by a newer update

---

## Demo

See: [`docs/demos/useDebouncedStateDemo.tsx`](./demos/useDebouncedStateDemo.tsx)

```tsx
import { useDebouncedState } from 'react-perf-hooks';

function SearchBox() {
  const [query, setQuery, stats] = useDebouncedState('', 250);

  return (
    <section>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type quickly..."
      />

      <p>Committed query: {query || '(empty)'}</p>
      <p>Total updates: {stats.totalUpdates}</p>
      <p>Skipped renders: {stats.skippedRenders}</p>
    </section>
  );
}
```

---

## Notes

- Stats are tracked in refs and synced to the returned `stats` object when updates commit.
- Functional updates are resolved against the latest queued value, preserving expected updater semantics during bursts.
- Pending debounce timers are cleared on unmount.
