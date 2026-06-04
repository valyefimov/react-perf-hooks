# useINP

Tracks **Interaction to Next Paint (INP)** using the browser Event Timing API. The hook keeps the worst interaction observed during the current page view and exposes it as React state.

## Why use it?

INP is the Core Web Vitals responsiveness metric. It captures how long a user interaction takes from the browser receiving input until the next paint can show the result.

Use `useINP` when you want to:

- Build a live responsiveness overlay without installing `web-vitals`
- Send the worst interaction latency to your analytics pipeline
- Spot slow clicks, taps, and key presses while developing React UI

> Browser support depends on `PerformanceObserver` support for the `event` entry type. The hook returns `isSupported: false` when unavailable.

---

## Import

```ts
import { useINP } from 'react-perf-hooks';
```

---

## Signature

```ts
function useINP(options?: UseINPOptions): UseINPReturn
```

---

## Parameters — `UseINPOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onMetric` | `(metric: INPMetric) => void` | — | Called whenever the worst observed interaction changes. |
| `durationThreshold` | `number` | `40` | Minimum event duration observed by the browser, in milliseconds. Lower values capture more entries but can add overhead. |
| `enabled` | `boolean` | `true` | Set to `false` to skip subscribing entirely. |

---

## Return value — `UseINPReturn`

| Field | Type | Description |
|-------|------|-------------|
| `metric` | `INPMetric \| null` | The worst INP interaction seen so far. |
| `value` | `number \| null` | Convenience value from `metric.value`, in milliseconds. |
| `rating` | `INPRating \| null` | `"good"`, `"needs-improvement"`, or `"poor"`. |
| `isSupported` | `boolean` | Whether the browser supports Event Timing entries. |

---

## `INPMetric`

```ts
interface INPMetric {
  name: 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  eventType: string;
  startTime: number;
  interactionId: number | null;
  timestamp: number;
}
```

## Rating thresholds

| Rating | INP value |
|--------|-----------|
| `good` | < 200 ms |
| `needs-improvement` | 200-500 ms |
| `poor` | > 500 ms |

---

## Examples

### Live INP badge

```tsx
import { useINP } from 'react-perf-hooks';

function INPBadge() {
  const { value, rating, isSupported } = useINP();

  if (!isSupported) {
    return <span>INP unavailable</span>;
  }

  return (
    <span>
      INP: {value === null ? 'waiting...' : `${value.toFixed(0)} ms (${rating})`}
    </span>
  );
}
```

### Report to analytics

```tsx
import { useINP } from 'react-perf-hooks';

function App() {
  useINP({
    onMetric(metric) {
      navigator.sendBeacon(
        '/api/inp',
        JSON.stringify({
          url: location.href,
          ...metric,
        })
      );
    },
  });

  return <RouterProvider router={router} />;
}
```

### Lower the observation threshold in development

```tsx
import { useINP } from 'react-perf-hooks';

function DevOverlay() {
  const { metric } = useINP({
    durationThreshold: 16,
    enabled: process.env.NODE_ENV === 'development',
  });

  return <pre>{JSON.stringify(metric, null, 2)}</pre>;
}
```

---

## Notes

- The hook tracks the worst observed interaction, matching INP's "page responsiveness" mental model.
- `durationThreshold` is passed to `PerformanceObserver.observe()`.
- Event Timing duration is measured by the browser from interaction start through presentation of the next paint.
