# react-perf-hooks — Documentation

A focused collection of React hooks for **performance monitoring, profiling, and Core Web Vitals** measurement.

## Available hooks

| Hook | Purpose |
|------|---------|
| [useRenderTracker](./useRenderTracker.md) | Count re-renders, detect which props changed, warn when threshold is exceeded |
| [usePerformanceMark](./usePerformanceMark.md) | Measure arbitrary code paths using the browser Performance API |
| [useComponentLifecycle](./useComponentLifecycle.md) | Track mount and unmount times, plus live lifetime since mount |
| [useMemoProfiling](./useMemoProfiling.md) | Profile `useMemo` cache effectiveness with HIT/MISS stats |
| [useWebVitals](./useWebVitals.md) | Subscribe to all five Core Web Vitals as reactive React state |
| [useDebouncedState](./useDebouncedState.md) | Debounced `useState` replacement with skipped-render profiling |
| [useThrottledState](./useThrottledState.md) | Throttled `useState` replacement with dropped-update profiling |
| [useIntersectionObserver](./useIntersectionObserver.md) | Observe element visibility and collect first-visible and total-visible metrics |

## Installation

```bash
npm install react-perf-hooks
```

For `useWebVitals`, also install the optional peer dependency:

```bash
npm install web-vitals
```

**Requirements:** React ≥ 16.8, Node ≥ 18 (dev/build only)

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
```

All hooks are **tree-shakeable** — only the hooks you import end up in your bundle.

## TypeScript

The package ships with full type declarations. No `@types/*` needed.

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

## Contributing

See the [Contributing guide](../README.md#contributing) in the root README.

## License

MIT © Valentyn Yefimov
