# react-perf-hooks

> A focused collection of React hooks for **performance monitoring, profiling, and Core Web Vitals** measurement.

[![npm version](https://img.shields.io/npm/v/react-perf-hooks.svg)](https://www.npmjs.com/package/react-perf-hooks)
[![license](https://img.shields.io/npm/l/react-perf-hooks.svg)](./LICENSE)
[![CI](https://github.com/valyefimov/react-perf-hooks/actions/workflows/ci.yml/badge.svg)](https://github.com/valyefimov/react-perf-hooks/actions)
[![bundle size](https://img.shields.io/bundlephobia/minzip/react-perf-hooks)](https://bundlephobia.com/package/react-perf-hooks)

**Live docs:** [react-perf-hooks docs website](https://valyefimov.github.io/react-perf-hooks/)

---

## Repository layout

This repository is a single-package library project. The npm package, Docusaurus docs, and examples
share one root `package.json`, one `pnpm-lock.yaml`, and one `node_modules` directory.

```text
react-perf-hooks/
├── src/            # library source plus Docusaurus UI files
├── docs/           # Docusaurus MDX documentation
├── examples/       # StackBlitz demos
├── static/         # Docusaurus static assets
├── docusaurus.config.ts
├── sidebars.ts
├── package.json
├── pnpm-lock.yaml
└── tsup.config.ts
```

Library type-checking is scoped to `src/hooks`, `src/index.ts`, and `src/test-setup.ts`.
Docusaurus has its own `tsconfig.docs.json`.

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
| `useRenderTracker` | Find components that re-render too often and why | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-render-tracker) |
| `useRenderBudget` | Warn when a single render commit exceeds a time budget (default: 16ms) | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-render-budget) |
| `usePerformanceMark` | Precise timing of any code path via the Performance API | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-performance-mark) |
| `useComponentLifecycle` | Track mount/unmount timings and live component lifetime | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-component-lifecycle) |
| `useMemoProfiling` | Profile `useMemo` cache hits/misses and recomputation costs | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-memo-profiling) |
| `useWebVitals` | Live Core Web Vitals (LCP, CLS, INP, FCP, TTFB) as React state | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-web-vitals) |
| `useINP` | Native Interaction to Next Paint tracking with PerformanceObserver event entries | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-inp) |
| `useCLS` | Component-scoped Cumulative Layout Shift tracking for a specific DOM node | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-cls) |
| `useLongTasks` | Log main-thread freezes over 50ms and attach them to the current screen | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-long-tasks) |
| `useMemoryStatus` | Monitor Chromium JavaScript heap usage and flag high memory pressure | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-memory-status) |
| `useDebouncedState` | Debounced `useState` with render-skip profiling counters | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-debounced-state) |
| `useThrottledState` | Throttled `useState` with dropped-update profiling counters | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-throttled-state) |
| `useIntersectionObserver` | Lazy-loading visibility state plus first-visible and total-visible metrics | [Full docs](https://valyefimov.github.io/react-perf-hooks/docs/hooks/use-intersection-observer) |

See the [docs overview](https://valyefimov.github.io/react-perf-hooks/docs/getting-started) for a complete reference.

---

## Quick start

```tsx
import {
  useRenderTracker,
  useRenderBudget,
  usePerformanceMark,
  useComponentLifecycle,
  useMemoProfiling,
  useWebVitals,
  useINP,
  useCLS,
  useLongTasks,
  useMemoryStatus,
  useDebouncedState,
  useThrottledState,
  useIntersectionObserver,
} from 'react-perf-hooks';

function App() {
  // Track re-renders and warn if a component renders more than 10 times
  const { count } = useRenderTracker({ userId }, { name: 'App', warnAt: 10 });

  // Warn when a render exceeds one frame budget (16ms by default)
  useRenderBudget(16, 'App');

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

  // Track the current page's worst Interaction to Next Paint
  const inp = useINP({
    onMetric: (m) => navigator.sendBeacon('/analytics/inp', JSON.stringify(m)),
  });

  // Track Cumulative Layout Shift for one component root
  const cls = useCLS<HTMLDivElement>({
    onMetric: (m) => navigator.sendBeacon('/analytics/cls/component', JSON.stringify(m)),
  });

  // Log main-thread freezes and attach them to the current screen
  useLongTasks({
    screen: () => location.pathname,
    onLongTask: (m) => navigator.sendBeacon('/analytics/long-tasks', JSON.stringify(m)),
  });

  // Monitor Chromium heap telemetry and flag high memory pressure
  const memory = useMemoryStatus({ warningThresholdRatio: 0.8, interval: 5000 });

  // Debounce state updates and inspect profiling counters
  const [query, setQuery, stats] = useDebouncedState('', 250);

  // Throttle high-frequency state while measuring discarded updates
  const [pointer, setPointer, pointerStats] = useThrottledState({ x: 0, y: 0 }, 120);

  // Track when an element first becomes visible and for how long it stays visible
  const { ref, isVisible, metrics } = useIntersectionObserver({ threshold: 0.25 });

  return <div ref={cls.ref}>...</div>;
}
```

Interactive demos live in [examples/stackblitz/hooks-playground](./examples/stackblitz/hooks-playground) and are embedded from the docs site.

---

## TypeScript

All hooks ship with full type declarations. No `@types/*` packages needed.

```ts
import type {
  RenderInfo,
  UseRenderTrackerOptions,
  UseRenderBudgetOptions,
  PerformanceMeasureResult,
  UsePerformanceMarkReturn,
  ComponentLifecycleInfo,
  MemoProfilingStats,
  WebVitalMetric,
  WebVitalsState,
  UseWebVitalsOptions,
  VitalRating,
  INPMetric,
  INPRating,
  UseINPOptions,
  UseINPReturn,
  CLSAttribution,
  CLSMetric,
  CLSRating,
  UseCLSOptions,
  UseCLSReturn,
  LongTaskAttribution,
  LongTaskMetric,
  UseLongTasksOptions,
  UseLongTasksReturn,
  UseMemoryStatusOptions,
  UseMemoryStatusReturn,
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
pnpm install          # Install dependencies
pnpm test             # Run tests in watch mode
pnpm test:coverage    # Run tests once with coverage
pnpm type-check       # Type-check the library
pnpm docs:type-check  # Type-check the Docusaurus site
pnpm lint             # Lint
pnpm format           # Format with Prettier
pnpm build            # Build CJS + ESM + .d.ts
pnpm docs:build       # Build the docs site
pnpm run ci           # Run the library CI checks locally
```

Each hook lives in its own directory under `src/hooks/`. To add a new hook:

1. Create `src/hooks/useYourHook/index.ts`
2. Add tests in `src/hooks/useYourHook/useYourHook.test.tsx`
3. Export from `src/index.ts`
4. Add a doc in `docs/hooks/use-your-hook.mdx` and link it from `sidebars.ts`

---

## License

MIT © [Valentyn Yefimov](https://github.com/valyefimov)
