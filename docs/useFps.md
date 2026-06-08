# useFps

Tracks the current **frames per second (FPS)** with `requestAnimationFrame` and returns a rolling average for adaptive UI decisions.

## Why use it?

Use `useFps` when you want to:

- Disable heavy animations, canvas effects, or background video on low-end devices
- Show a performance mode toggle when the browser cannot sustain a target frame rate
- Report low-FPS episodes to diagnostics without collecting every frame

> The hook returns `isSupported: false` when `requestAnimationFrame` or `cancelAnimationFrame` is unavailable.

---

## Import

```ts
import { useFps } from 'react-perf-hooks';
```

---

## Signature

```ts
function useFps(options?: UseFpsOptions): UseFpsReturn
```

---

## Parameters — `UseFpsOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `30` | FPS threshold used to set `isLowPerformance`. Values below this threshold are considered low performance. |
| `windowSize` | `number` | `10` | Number of recent frame deltas used for the moving average. |
| `onDrop` | `(currentFps: number) => void` | — | Called when the rolling average crosses below `threshold`. |
| `enabled` | `boolean` | `true` | Set to `false` to skip the rAF loop entirely. |

---

## Return value — `UseFpsReturn`

| Field | Type | Description |
|-------|------|-------------|
| `fps` | `number` | Rolling-averaged FPS. Returns `0` until the first measured frame. |
| `isLowPerformance` | `boolean` | Whether `fps` is below `threshold`. |
| `isSupported` | `boolean` | Whether the browser supports `requestAnimationFrame` and `cancelAnimationFrame`. |

---

## Examples

### Adaptive animation fallback

```tsx
import { useFps } from 'react-perf-hooks';

function ProductHero() {
  const { fps, isLowPerformance } = useFps({
    threshold: 30,
    windowSize: 10,
  });

  return (
    <section>
      <p>FPS: {fps.toFixed(0)}</p>
      {isLowPerformance ? <StaticProductImage /> : <HeavyLottieAnimation />}
    </section>
  );
}
```

### Report low-FPS episodes

```tsx
import { useFps } from 'react-perf-hooks';

function AppShell() {
  useFps({
    threshold: 30,
    windowSize: 20,
    onDrop(currentFps) {
      navigator.sendBeacon(
        '/analytics/fps-drop',
        JSON.stringify({
          currentFps,
          url: location.href,
          timestamp: Date.now(),
        })
      );
    },
  });

  return <AppRoutes />;
}
```

### Disable expensive effects only in production

```tsx
import { useFps } from 'react-perf-hooks';

function BackgroundEffects() {
  const { isLowPerformance, isSupported } = useFps({
    threshold: 45,
    windowSize: 15,
    enabled: process.env.NODE_ENV === 'production',
  });

  if (!isSupported || isLowPerformance) {
    return null;
  }

  return <CanvasParticles />;
}
```

---

## Notes

- The first animation frame establishes the baseline timestamp; `fps` updates after the next frame.
- `windowSize` is normalized to at least `1`, so fractional values still produce a valid rolling average.
- `onDrop` fires on transitions into low-performance mode, not on every low-FPS frame.
- The hook cancels the active `requestAnimationFrame` loop immediately on unmount.
