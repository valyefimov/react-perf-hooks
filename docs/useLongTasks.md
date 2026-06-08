# useLongTasks

Tracks browser **Long Tasks** using `PerformanceObserver` with the `longtask` entry type. A long task is main-thread work that blocks the browser for more than 50 ms.

## Why use it?

Use `useLongTasks` when you want to:

- Log when the app freezes during a page view
- Attach the freeze to the current screen, route, or view
- Build a development overlay for main-thread blocking work
- Send long-task and total-blocking-time data to analytics

> Browser support depends on `PerformanceObserver` support for the `longtask` entry type. The hook returns `isSupported: false` when unavailable.

---

## Import

```ts
import { useLongTasks } from 'react-perf-hooks';
```

---

## Signature

```ts
function useLongTasks(options?: UseLongTasksOptions): UseLongTasksReturn
```

---

## Parameters - `UseLongTasksOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onLongTask` | `(metric: LongTaskMetric) => void` | - | Called whenever a matching long task is observed. |
| `screen` | `string \| (() => string \| null \| undefined) \| null` | `null` | Current screen, route, or view attached to each metric. |
| `minDuration` | `number` | `50` | Minimum task duration retained by the hook, in milliseconds. Raise this to log only severe freezes. |
| `maxEntries` | `number` | `50` | Maximum number of long-task metrics retained in state. |
| `enabled` | `boolean` | `true` | Set to `false` to skip subscribing entirely. |

---

## Return value - `UseLongTasksReturn`

| Field | Type | Description |
|-------|------|-------------|
| `latest` | `LongTaskMetric \| null` | Latest retained long task. |
| `entries` | `LongTaskMetric[]` | Retained long-task metrics for debugging and overlays. |
| `count` | `number` | Number of retained long tasks. |
| `totalBlockingTime` | `number` | Sum of retained `blockingTime` values. |
| `isSupported` | `boolean` | Whether the browser supports Long Tasks entries. |

---

## `LongTaskMetric`

```ts
interface LongTaskMetric {
  name: 'longtask';
  duration: number;
  blockingTime: number;
  startTime: number;
  screen: string | null;
  attribution: LongTaskAttribution[];
  timestamp: number;
}
```

`blockingTime` is `duration - 50`, clamped at `0`, matching the long-task budget.

---

## Examples

### Log freezes by route

```tsx
import { useLongTasks } from 'react-perf-hooks';

function LongTaskProbe() {
  useLongTasks({
    screen: () => location.pathname,
    onLongTask(metric) {
      navigator.sendBeacon('/api/long-tasks', JSON.stringify(metric));
    },
  });

  return null;
}
```

### Development overlay

```tsx
import { useLongTasks } from 'react-perf-hooks';

function LongTaskOverlay() {
  const { latest, count, totalBlockingTime, isSupported } = useLongTasks({
    screen: 'checkout',
    minDuration: 75,
    enabled: process.env.NODE_ENV === 'development',
  });

  if (!isSupported) {
    return <p>Long Tasks API unavailable</p>;
  }

  return (
    <aside>
      <strong>Long tasks:</strong> {count}
      <br />
      <strong>Total blocking:</strong> {totalBlockingTime.toFixed(0)} ms
      <br />
      <strong>Latest freeze:</strong> {latest ? `${latest.duration.toFixed(0)} ms on ${latest.screen}` : 'waiting'}
    </aside>
  );
}
```

---

## Notes

- The browser only emits `longtask` entries for tasks of 50 ms or longer.
- Use `screen` as a function when a router can change location without remounting the observer.
- Attribution details are browser-dependent and may be empty.
