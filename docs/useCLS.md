# useCLS

Tracks **Cumulative Layout Shift (CLS)** for a specific component root. Attach the returned `ref` to the DOM node you want to inspect; the hook accumulates layout-shift entries attributed to that element or, by default, its descendants.

## Why use it?

Page-level CLS tells you that something moved. Component-scoped CLS helps you find which card, banner, image, widget, or async content block caused the shift.

Use `useCLS` when you want to:

- Build a live layout-shift overlay for a suspicious component
- Report component-level CLS attribution to analytics
- Catch dynamic content that jumps because dimensions were not reserved

> Browser support depends on `PerformanceObserver` support for the `layout-shift` entry type. The hook returns `isSupported: false` when unavailable.

---

## Import

```ts
import { useCLS } from 'react-perf-hooks';
```

---

## Signature

```ts
function useCLS<T extends Element = HTMLElement>(options?: UseCLSOptions): UseCLSReturn<T>
```

---

## Parameters — `UseCLSOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onMetric` | `(metric: CLSMetric) => void` | — | Called whenever a matching layout shift changes the component CLS value. |
| `includeDescendants` | `boolean` | `true` | Include layout shifts attributed to descendants of the observed element. |
| `ignoreRecentInput` | `boolean` | `true` | Ignore shifts shortly after user input, matching Core Web Vitals CLS behavior. |
| `maxEntries` | `number` | `50` | Maximum number of matching layout-shift metrics retained in state. |
| `enabled` | `boolean` | `true` | Set to `false` to skip subscribing entirely. |

---

## Return value — `UseCLSReturn`

| Field | Type | Description |
|-------|------|-------------|
| `ref` | `(node: T \| null) => void` | Attach to the component root you want to inspect. |
| `metric` | `CLSMetric \| null` | Latest cumulative CLS metric for the observed element. |
| `value` | `number` | Current cumulative CLS value. Starts at `0`. |
| `rating` | `CLSRating \| null` | `"good"`, `"needs-improvement"`, or `"poor"`. |
| `entries` | `CLSMetric[]` | Matching layout-shift metrics retained for debugging. |
| `isSupported` | `boolean` | Whether the browser supports Layout Instability entries. |

---

## `CLSMetric`

```ts
interface CLSMetric {
  name: 'CLS';
  value: number;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  startTime: number;
  hadRecentInput: boolean;
  sources: CLSAttribution[];
  timestamp: number;
}
```

## Rating thresholds

| Rating | CLS value |
|--------|-----------|
| `good` | < 0.1 |
| `needs-improvement` | 0.1-0.25 |
| `poor` | > 0.25 |

---

## Examples

### Find a jumping component

```tsx
import { useCLS } from 'react-perf-hooks';

function ProductCard() {
  const { ref, value, rating, isSupported } = useCLS<HTMLDivElement>();

  return (
    <article ref={ref}>
      <img src="/product.jpg" alt="" />
      <strong>Component CLS</strong>
      <span>{isSupported ? `${value.toFixed(3)} (${rating ?? 'waiting'})` : 'unavailable'}</span>
    </article>
  );
}
```

### Report component-level shifts

```tsx
import { useCLS } from 'react-perf-hooks';

function PromoBanner() {
  const { ref } = useCLS<HTMLDivElement>({
    onMetric(metric) {
      navigator.sendBeacon(
        '/api/component-cls',
        JSON.stringify({
          component: 'PromoBanner',
          url: location.href,
          ...metric,
        })
      );
    },
  });

  return <div ref={ref}>...</div>;
}
```

### Only track the root element

```tsx
import { useCLS } from 'react-perf-hooks';

function Shell() {
  const cls = useCLS<HTMLElement>({
    includeDescendants: false,
  });

  return <main ref={cls.ref}>...</main>;
}
```

---

## Notes

- `useCLS` relies on layout-shift attribution sources. Entries with no matching source are ignored.
- By default, descendant attribution is included because the browser often reports the shifted child node rather than the component root.
- `ignoreRecentInput` defaults to `true` so the value follows Core Web Vitals CLS semantics.
