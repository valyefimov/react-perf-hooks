# useWebVitals

Subscribes to all five [Core Web Vitals](https://web.dev/vitals/) and exposes them as live React state. Each metric updates automatically when the browser fires it — no polling, no manual event listeners.

## Why use it?

Core Web Vitals (CWV) are Google's official quality signals and directly affect search rankings. This hook lets you:

- Display live CWV inside your app (e.g. a dev overlay or admin panel)
- Report metrics to any analytics service via the `onMetric` callback
- Gate certain UI decisions on metric values (e.g. disable animations when CLS is high)

> **Requires** the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) package:
> ```bash
> npm install web-vitals
> ```

---

## Import

```ts
import { useWebVitals } from 'react-perf-hooks';
```

---

## Signature

```ts
function useWebVitals(options?: UseWebVitalsOptions): WebVitalsState
```

---

## Parameters — `UseWebVitalsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onMetric` | `(metric: WebVitalMetric) => void` | — | Called every time any vital is updated. Use this to send data to an analytics backend. |
| `enabled` | `boolean` | `true` | Set to `false` to skip subscribing entirely (useful for SSR or tests). |

---

## Return value — `WebVitalsState`

Each key holds a `WebVitalMetric | null`. The value is `null` until the browser fires the corresponding event (which can be seconds after page load for some metrics).

| Key | Metric | Unit | Good | Needs improvement | Poor |
|-----|--------|------|------|-------------------|------|
| `LCP` | Largest Contentful Paint | ms | < 2500 | 2500–4000 | > 4000 |
| `CLS` | Cumulative Layout Shift | score | < 0.1 | 0.1–0.25 | > 0.25 |
| `INP` | Interaction to Next Paint | ms | < 200 | 200–500 | > 500 |
| `FCP` | First Contentful Paint | ms | < 1800 | 1800–3000 | > 3000 |
| `TTFB` | Time to First Byte | ms | < 800 | 800–1800 | > 1800 |

---

## `WebVitalMetric`

```ts
interface WebVitalMetric {
  name: string;              // "CLS" | "LCP" | "INP" | "FCP" | "TTFB"
  value: number;             // The metric value in its native unit
  rating: VitalRating;       // "good" | "needs-improvement" | "poor"
  delta: number;             // Change since the last report (= value on first report)
  id: string;                // Stable unique ID — use for deduplication in analytics
}

type VitalRating = 'good' | 'needs-improvement' | 'poor';
```

### `delta` vs `value`

- `value` — the current cumulative metric value
- `delta` — how much it changed since the last time `onMetric` was called

For analytics, always send `delta`, not `value`, to avoid double-counting when a metric is reported multiple times (CLS and INP can update several times per page view).

---

## Examples

### Live performance overlay

```tsx
import { useWebVitals, type WebVitalMetric } from 'react-perf-hooks';

const ratingStyles: Record<string, string> = {
  good: 'color: #0cce6b',
  'needs-improvement': 'color: #ffa400',
  poor: 'color: #ff4e42',
};

function PerfOverlay() {
  const { LCP, CLS, INP, FCP, TTFB } = useWebVitals();

  const rows: Array<{ label: string; metric: WebVitalMetric | null; unit: string }> = [
    { label: 'LCP',  metric: LCP,  unit: 'ms' },
    { label: 'INP',  metric: INP,  unit: 'ms' },
    { label: 'FCP',  metric: FCP,  unit: 'ms' },
    { label: 'TTFB', metric: TTFB, unit: 'ms' },
    { label: 'CLS',  metric: CLS,  unit: '' },
  ];

  return (
    <aside style={{ fontFamily: 'monospace', fontSize: 12 }}>
      {rows.map(({ label, metric, unit }) => (
        <div key={label}>
          <b>{label}:</b>{' '}
          {metric ? (
            <span style={{ ...parseStyle(ratingStyles[metric.rating]) }}>
              {metric.value.toFixed(unit ? 0 : 3)}{unit} — {metric.rating}
            </span>
          ) : (
            <span style={{ color: '#999' }}>waiting…</span>
          )}
        </div>
      ))}
    </aside>
  );
}
```

### Report to Google Analytics 4

```tsx
import { useWebVitals } from 'react-perf-hooks';

function App() {
  useWebVitals({
    onMetric({ name, value, rating, delta, id }) {
      // gtag is injected by the GA4 snippet
      window.gtag?.('event', name, {
        // Use delta so repeated reports don't double-count
        value: Math.round(name === 'CLS' ? delta * 1000 : delta),
        metric_id: id,
        metric_value: value,
        metric_delta: delta,
        metric_rating: rating,
        non_interaction: true,
      });
    },
  });

  return <RouterProvider router={router} />;
}
```

### Report to a custom endpoint

```tsx
import { useWebVitals } from 'react-perf-hooks';

function App() {
  useWebVitals({
    onMetric(metric) {
      // sendBeacon is fire-and-forget and survives page unload
      navigator.sendBeacon(
        '/api/vitals',
        JSON.stringify({
          url: location.href,
          ...metric,
          timestamp: Date.now(),
        })
      );
    },
  });

  return <RouterProvider router={router} />;
}
```

### Conditional rendering based on CLS

```tsx
import { useWebVitals } from 'react-perf-hooks';

function AnimatedBanner() {
  const { CLS } = useWebVitals();

  // Disable animations if layout stability is already poor
  const shouldAnimate = !CLS || CLS.rating === 'good';

  return (
    <div className={shouldAnimate ? 'banner--animated' : 'banner--static'}>
      ...
    </div>
  );
}
```

### Disable during SSR (Next.js / Remix)

```tsx
import { useWebVitals } from 'react-perf-hooks';

function App() {
  useWebVitals({
    // Only subscribe in the browser
    enabled: typeof window !== 'undefined',
    onMetric: sendToAnalytics,
  });

  return <Layout />;
}
```

---

## When are metrics reported?

| Metric | When it fires |
|--------|--------------|
| **FCP** | When the browser first renders any text or image |
| **TTFB** | When the first byte of the response is received |
| **LCP** | When the largest content element becomes visible; may update multiple times |
| **CLS** | Batched — fires after the page is hidden or after each layout shift burst |
| **INP** | Fires after each interaction (click, key press, tap); updates with the worst score |

Because of this, some metrics (LCP, CLS, INP) can fire multiple times. Always use `id` for deduplication in your analytics pipeline.

---

## How it works

1. The hook calls `import('web-vitals')` inside a `useEffect` (lazy, runs once after mount).
2. It subscribes to all five `on*` functions from the `web-vitals` package.
3. Each callback calls `setVitals` with the new metric, triggering a re-render only for the changed key.
4. Your `onMetric` callback is called after state is updated.
5. When `enabled` is `false` or `window` is undefined (SSR), the effect exits immediately.

---

## Troubleshooting

**All vitals stay `null` in development**

Most vitals require real user interaction or specific lifecycle events that may not happen in a dev server. Use an incognito window and interact with the page, or use Chrome DevTools' Performance panel instead.

**`web-vitals` not found warning in the console**

Install the package: `npm install web-vitals`

**CLS / INP not reported in tests**

These metrics rely on browser events that jsdom does not simulate. Use `enabled: false` in tests, or mock the `web-vitals` module (see the hook's test file for an example).

---

## TypeScript interfaces

```ts
type VitalRating = 'good' | 'needs-improvement' | 'poor';

interface WebVitalMetric {
  name: string;
  value: number;
  rating: VitalRating;
  delta: number;
  id: string;
}

interface WebVitalsState {
  CLS: WebVitalMetric | null;
  LCP: WebVitalMetric | null;
  INP: WebVitalMetric | null;
  FCP: WebVitalMetric | null;
  TTFB: WebVitalMetric | null;
}

interface UseWebVitalsOptions {
  onMetric?: (metric: WebVitalMetric) => void;
  enabled?: boolean;
}
```
