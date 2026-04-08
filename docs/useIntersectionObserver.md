# useIntersectionObserver

Observe an element with the browser `IntersectionObserver` API and capture two visibility metrics out of the box: when it first became visible and how long it has been visible in total.

## Why use it?

Lazy loading is only half the job. Once an element intersects the viewport, you often want to know:

- When it first became visible relative to page load (`firstVisibleAt`)
- How much cumulative time it spent visible (`totalVisibleMs`)
- Whether it is visible right now (`isVisible`)

This hook wraps those concerns into one SSR-safe API that works well for images, hero sections, ads, and engagement analytics.

---

## Import

```ts
import { useIntersectionObserver } from 'react-perf-hooks';
```

---

## Signature

```ts
function useIntersectionObserver<T extends Element = Element>(
  options?: IntersectionObserverInit
): UseIntersectionObserverReturn<T>
```

---

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `IntersectionObserverInit` | Standard observer options: `root`, `rootMargin`, and `threshold` |

Notes:

- `threshold` controls when `isVisible` flips to `true`
- `root` defaults to the viewport
- When rendered on the server, no observer is created

---

## Return value

### `ref`

Callback ref to attach to the target element you want to observe.

### `isVisible`

`true` when the latest observer entry satisfies the configured threshold, otherwise `false`.

### `metrics`

```ts
interface IntersectionObserverMetrics {
  firstVisibleAt: number | null;
  totalVisibleMs: number;
}
```

- `firstVisibleAt`: first time the target became visible, in ms since page load
- `totalVisibleMs`: accumulated visible time across every visible session

`totalVisibleMs` is flushed whenever the target leaves the visible state or the observer is cleaned up.

---

## Demo

See: [`docs/demos/useIntersectionObserverDemo.tsx`](./demos/useIntersectionObserverDemo.tsx)

```tsx
import { useIntersectionObserver } from 'react-perf-hooks';

function HeroImage() {
  const { ref, isVisible, metrics } = useIntersectionObserver<HTMLImageElement>({
    rootMargin: '200px 0px',
    threshold: 0.25,
  });

  return (
    <figure>
      <img
        ref={ref}
        src={isVisible ? '/hero-full.jpg' : '/hero-placeholder.jpg'}
        alt="Mountains at sunrise"
      />
      <figcaption>
        First visible at: {metrics.firstVisibleAt?.toFixed(1) ?? 'not yet'} ms
      </figcaption>
      <figcaption>Total visible: {metrics.totalVisibleMs.toFixed(1)} ms</figcaption>
    </figure>
  );
}
```

---

## Notes

- The hook uses `IntersectionObserverEntry.time` so timestamps align with the page-load-relative clock used by the Performance API.
- If the target is visible when the observer is disconnected, the hook commits the in-progress visible duration during cleanup.
- When `IntersectionObserver` is unavailable, the hook remains inert and returns the initial state.

---

## TypeScript interfaces

```ts
interface IntersectionObserverMetrics {
  firstVisibleAt: number | null;
  totalVisibleMs: number;
}

interface UseIntersectionObserverReturn<T extends Element = Element> {
  ref: (node: T | null) => void;
  isVisible: boolean;
  metrics: IntersectionObserverMetrics;
}
```
