# usePerformanceMark

A hook-friendly wrapper around the browser [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance). Creates named marks, measures durations between them, and collects results for batch analytics reporting.

## Why use it?

`performance.mark()` and `performance.measure()` are the most accurate way to time code in a browser — they use the same high-resolution clock as DevTools. This hook:

- Gives you `mark` / `measure` as stable callbacks (safe for `useEffect` dependency arrays)
- Supports **namespacing** to avoid mark-name collisions across components
- Accumulates results so you can batch-send them to an analytics endpoint on unmount
- Falls back gracefully (returns `null`) when the Performance API is not supported

---

## Import

```ts
import { usePerformanceMark } from 'react-perf-hooks';
```

---

## Signature

```ts
function usePerformanceMark(namespace?: string): UsePerformanceMarkReturn
```

---

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | `string` (optional) | Prefix applied to all mark and measure names. E.g. `"DataGrid"` turns `"render-start"` into `"DataGrid:render-start"`. Prevents collisions when multiple components instrument the same mark names. |

---

## Return value — `UsePerformanceMarkReturn`

### `mark(markName: string): void`

Creates a `performance.mark`. The actual name used in the browser is `{namespace}:{markName}` (or just `{markName}` when no namespace is set).

### `measure(measureName, startMark, endMark?): PerformanceMeasureResult | null`

Measures the time between `startMark` and `endMark` (or from `startMark` to _now_ when `endMark` is omitted). Returns a `PerformanceMeasureResult` or `null` if measurement fails (e.g. a mark was never created).

### `clearMarks(markName?: string): void`

Removes a specific mark (or all marks when called without an argument).

### `clearMeasures(measureName?: string): void`

Removes a specific measure entry (or all measures).

### `getEntries(): PerformanceMeasureResult[]`

Returns all measurements that have been recorded since the hook was mounted. Useful for sending a batch of timings to an analytics endpoint.

---

## `PerformanceMeasureResult`

```ts
interface PerformanceMeasureResult {
  name: string;       // The measureName you passed (without namespace prefix)
  duration: number;   // Duration in milliseconds (high-resolution float)
  startTime: number;  // Absolute start time from navigation origin (ms)
}
```

---

## Examples

### Measure a data fetch

```tsx
import { useEffect } from 'react';
import { usePerformanceMark } from 'react-perf-hooks';

function ProductList() {
  const { mark, measure, getEntries } = usePerformanceMark('ProductList');

  useEffect(() => {
    async function loadProducts() {
      mark('fetch-start');
      const data = await fetch('/api/products').then((r) => r.json());
      mark('fetch-end');

      const result = measure('fetch', 'fetch-start', 'fetch-end');
      console.log(`Fetch took ${result?.duration.toFixed(1)} ms`);

      return data;
    }

    loadProducts();

    return () => {
      // Batch-send all timings when the component unmounts
      const entries = getEntries();
      if (entries.length > 0) {
        navigator.sendBeacon('/analytics/timings', JSON.stringify(entries));
      }
    };
  }, [mark, measure, getEntries]);

  return <ul>...</ul>;
}
```

### Measure render time

```tsx
import { useRef, useEffect } from 'react';
import { usePerformanceMark } from 'react-perf-hooks';

function HeavyVisualization({ dataset }: { dataset: number[] }) {
  const { mark, measure } = usePerformanceMark('HeavyViz');
  const isFirstRender = useRef(true);

  // Called during render phase — marks the start
  mark('render-start');

  useEffect(() => {
    // Called after the DOM has been painted — marks the end
    mark('render-end');
    const result = measure('paint-time', 'render-start', 'render-end');

    if (result) {
      const label = isFirstRender.current ? 'Initial paint' : 'Re-paint';
      console.log(`[HeavyViz] ${label}: ${result.duration.toFixed(2)} ms`);
      isFirstRender.current = false;
    }
  });

  return <canvas id="chart" />;
}
```

### Visible in Chrome DevTools

All marks and measures created by this hook appear in the **Timings** row of the Chrome DevTools Performance panel — exactly as if you had called `performance.mark()` yourself.

```tsx
// These will appear in DevTools as:
// Timeline markers:  "Checkout:validate-start", "Checkout:validate-end"
// Measure band:      "Checkout:validation-duration"
function CheckoutForm() {
  const { mark, measure } = usePerformanceMark('Checkout');

  async function handleSubmit() {
    mark('validate-start');
    await validateForm();
    mark('validate-end');
    measure('validation-duration', 'validate-start', 'validate-end');
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Report to analytics on unmount

```tsx
import { useEffect } from 'react';
import { usePerformanceMark } from 'react-perf-hooks';

function Dashboard() {
  const { mark, measure, getEntries } = usePerformanceMark('Dashboard');

  useEffect(() => {
    mark('mount');
    return () => {
      mark('unmount');
      measure('session-duration', 'mount', 'unmount');

      // Send everything: fetch time, render time, session duration, etc.
      fetch('/api/perf', {
        method: 'POST',
        body: JSON.stringify(getEntries()),
        keepalive: true, // ensures the request survives page unload
      });
    };
  }, [mark, measure, getEntries]);

  return <div>...</div>;
}
```

### Graceful degradation

On environments where `performance.mark` is not available (old browsers, some SSR contexts), all methods are no-ops and `measure()` returns `null`:

```tsx
const { mark, measure } = usePerformanceMark('App');

mark('start'); // safe — does nothing if unsupported

const result = measure('init', 'start');
if (result) {
  // Only runs in supported environments
  sendMetric(result);
}
```

---

## How it works

1. All stable callbacks (`mark`, `measure`, `clearMarks`, `clearMeasures`, `getEntries`) are created with `useCallback` and memoised on the `namespace`.
2. Measurement results are accumulated in a `useRef` array (never triggers a re-render).
3. The `isSupported` check runs once at module level (not per hook call).

---

## TypeScript interfaces

```ts
interface PerformanceMeasureResult {
  name: string;
  duration: number;
  startTime: number;
}

interface UsePerformanceMarkReturn {
  mark: (markName: string) => void;
  measure: (
    measureName: string,
    startMark: string,
    endMark?: string
  ) => PerformanceMeasureResult | null;
  clearMarks: (markName?: string) => void;
  clearMeasures: (measureName?: string) => void;
  getEntries: () => PerformanceMeasureResult[];
}
```
