# react-perf-hooks

> A focused collection of React hooks for **performance monitoring, profiling, and Core Web Vitals** measurement.

[![npm version](https://img.shields.io/npm/v/react-perf-hooks.svg)](https://www.npmjs.com/package/react-perf-hooks)
[![license](https://img.shields.io/npm/l/react-perf-hooks.svg)](./LICENSE)
[![CI](https://github.com/valyefimov/react-perf-hooks/actions/workflows/ci.yml/badge.svg)](https://github.com/valyefimov/react-perf-hooks/actions)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-perf-hooks)](https://bundlephobia.com/package/react-perf-hooks)

---

## Why react-perf-hooks?

Most hook libraries give you `useDebounce` and `useLocalStorage`. This one does one thing: helps you **measure, diagnose, and understand performance** in React apps.

All hooks are **tree-shakeable**, **TypeScript-first**, and have **zero runtime dependencies** (web-vitals is an optional peer dep).

---

## Installation

```bash
npm install react-perf-hooks
```

For `useWebVitals`, also install the optional peer dependency:

```bash
npm install web-vitals
```

**Requirements:** React >= 16.8

---

## Hooks

| Hook | What it solves | Docs |
|------|---------------|------|
| `useRenderTracker` | Find components that re-render too often and why | [Full docs](./docs/useRenderTracker.md) |
| `usePerformanceMark` | Precise timing of any code path via the Performance API | [Full docs](./docs/usePerformanceMark.md) |
| `useComponentLifecycle` | Track mount/unmount timings and live component lifetime | [Full docs](./docs/useComponentLifecycle.md) |
| `useMemoProfiling` | Profile `useMemo` cache hits/misses and recomputation costs | [Full docs](./docs/useMemoProfiling.md) |
| `useWebVitals` | Live Core Web Vitals (LCP, CLS, INP, FCP, TTFB) as React state | [Full docs](./docs/useWebVitals.md) |
| `useDebouncedState` | Debounced `useState` with render-skip profiling counters | [Full docs](./docs/useDebouncedState.md) |
| `useThrottledState` | Throttled `useState` with dropped-update profiling counters | [Full docs](./docs/useThrottledState.md) |
| `useIntersectionObserver` | Lazy-loading visibility state plus first-visible and total-visible metrics | [Full docs](./docs/useIntersectionObserver.md) |

See the [docs overview](./docs/index.md) for a complete reference.

---

## Quick start

```tsx
import {
  useRenderTracker,
  usePerformanceMark,
  useComponentLifecycle,
  useMemoProfiling,
  useWebVitals,
  useDebouncedState,
  useThrottledState,
  useIntersectionObserver,
} from 'react-perf-hooks';

function App() {
  // Track re-renders and warn if a component renders more than 10 times
  const { count } = useRenderTracker({ userId }, { name: 'App', warnAt: 10 });

  // Measure fetch duration with the Performance API
  const { mark, measure } = usePerformanceMark('App');

  // Track mount time and current lifetime of a component
  const { mountedAt, aliveMs } = useComponentLifecycle('App');

  // Profile whether this memoized computation is mostly cache HITs or MISSes
  const filteredUsers = useMemoProfiling(() => users.filter((u) => u.active), [users], 'ActiveUsers');

  // Subscribe to Core Web Vitals and report to analytics
  const vitals = useWebVitals({
    onMetric: (m) => navigator.sendBeacon('/analytics', JSON.stringify(m)),
  });

  // Debounce state updates and inspect profiling counters
  const [query, setQuery, stats] = useDebouncedState('', 250);

  // Throttle high-frequency state while measuring discarded updates
  const [pointer, setPointer, pointerStats] = useThrottledState({ x: 0, y: 0 }, 120);

  // Track when an element first becomes visible and for how long it stays visible
  const { ref, isVisible, metrics } = useIntersectionObserver({ threshold: 0.25 });

  return <div>...</div>;
}
```

`useDebouncedState` demo: [docs/demos/useDebouncedStateDemo.tsx](./docs/demos/useDebouncedStateDemo.tsx)

`useThrottledState` demo: [docs/demos/useThrottledStateDemo.tsx](./docs/demos/useThrottledStateDemo.tsx)

`useComponentLifecycle` demo: [docs/demos/useComponentLifecycleDemo.tsx](./docs/demos/useComponentLifecycleDemo.tsx)

`useMemoProfiling` demo: [docs/demos/useMemoProfilingDemo.tsx](./docs/demos/useMemoProfilingDemo.tsx)

`useIntersectionObserver` demo: [docs/demos/useIntersectionObserverDemo.tsx](./docs/demos/useIntersectionObserverDemo.tsx)

---

## TypeScript

All hooks ship with full type declarations. No `@types/*` packages needed.

```ts
import type {
  RenderInfo,
  UseRenderTrackerOptions,
  PerformanceMeasureResult,
  UsePerformanceMarkReturn,
  ComponentLifecycleInfo,
  MemoProfilingStats,
  WebVitalMetric,
  WebVitalsState,
  UseWebVitalsOptions,
  VitalRating,
  DebouncedStateStats,
  UseDebouncedStateReturn,
  ThrottledStateStats,
  UseThrottledStateOptions,
  UseThrottledStateReturn,
  IntersectionObserverMetrics,
  UseIntersectionObserverReturn,
} from 'react-perf-hooks';
```

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

```bash
npm install          # Install dependencies
npm test             # Run tests in watch mode
npm run test:coverage # Run tests once with coverage
npm run type-check   # Type-check
npm run lint         # Lint
npm run format       # Format with Prettier
npm run build        # Build CJS + ESM + .d.ts
```

Each hook lives in its own directory under `src/hooks/`. To add a new hook:

1. Create `src/hooks/useYourHook/index.ts`
2. Add tests in `src/hooks/useYourHook/useYourHook.test.tsx`
3. Export from `src/index.ts`
4. Add a doc in `docs/useYourHook.md` and link it from `docs/index.md`

---

## License

MIT © [Valentyn Yefimov](https://github.com/valyefimov)
