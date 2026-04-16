# useMemoProfiling

`useMemo` wrapper that reports cache HIT/MISS effectiveness in development and tracks stats per label.

## Why use it?

`useMemo` is often added without verification. This hook makes it measurable:

- Shows whether memoization is actually producing cache hits
- Logs recomputation cost when cache misses happen
- Exposes programmatic stats with `getStats(label)`

In production it behaves as a plain `useMemo` with no profiling output.

## Import

```ts
import { getStats, useMemoProfiling } from 'react-perf-hooks';
```

## Signature

```ts
function useMemoProfiling<T>(
  factory: () => T,
  deps: DependencyList,
  label?: string
): T

function getStats(label?: string): MemoProfilingStats
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `factory` | `() => T` | Same as `useMemo` factory |
| `deps` | `DependencyList` | Same dependency list semantics as `useMemo` |
| `label` | `string` | Optional grouping key for logs and stats (default: `"default"`) |

## Return value

Same as `useMemo`: returns the memoized value of type `T`.

## Console output (development only)

```txt
[useMemoProfiling:SearchFilter] MISS (recomputed in 2.41ms)
[useMemoProfiling:SearchFilter] HIT
```

## `getStats(label)` result

```ts
interface MemoProfilingStats {
  label: string;
  hits: number;
  misses: number;
  totalRecomputeMs: number;
  averageRecomputeMs: number;
}
```

## Example

```tsx
import { getStats, useMemoProfiling } from 'react-perf-hooks';

function ProductTable({ products, query }: Props) {
  const filtered = useMemoProfiling(
    () => products.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [products, query],
    'ProductTable:filter'
  );

  const stats = getStats('ProductTable:filter');

  return (
    <section>
      <p>Hits: {stats.hits} | Misses: {stats.misses}</p>
      <ul>{filtered.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
    </section>
  );
}
```

## Notes

- First render is always a cache MISS because the value is computed for the first time.
- In production (`NODE_ENV=production`), logging and stats collection are disabled.
