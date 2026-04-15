# useComponentLifecycle

Tracks when a component mounted and how long it has been alive. In development mode, it logs mount and unmount lifecycle events with timing details.

## Why use it?

Lifecycle timing helps with:

- Spotting accidental re-mounts of expensive components
- Verifying whether cleanup happens quickly during unmount
- Comparing real component lifetime between user flows

## Import

```ts
import { useComponentLifecycle } from 'react-perf-hooks';
```

## Signature

```ts
function useComponentLifecycle(componentName?: string): ComponentLifecycleInfo
```

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `componentName` | `string` | Optional label included in lifecycle logs |

## Return value — `ComponentLifecycleInfo`

| Field | Type | Description |
|-------|------|-------------|
| `mountedAt` | `number` | `performance.now()` timestamp captured at mount |
| `aliveMs` | `number` | Milliseconds elapsed since mount, recalculated on each render |

## Console output (development only)

Without a `componentName`:

```txt
[useComponentLifecycle] mounted at 512.35 ms
[useComponentLifecycle] unmounted at 1930.10 ms (alive 1417.75 ms)
```

With a `componentName`:

```txt
[useComponentLifecycle:UserTable] mounted at 512.35 ms
[useComponentLifecycle:UserTable] unmounted at 1930.10 ms (alive 1417.75 ms)
```

## Examples

### Basic usage

```tsx
import { useComponentLifecycle } from 'react-perf-hooks';

function HeavyPanel() {
  const { mountedAt, aliveMs } = useComponentLifecycle('HeavyPanel');

  return (
    <div>
      Mounted at: {mountedAt.toFixed(1)} ms
      <br />
      Alive: {aliveMs.toFixed(1)} ms
    </div>
  );
}
```

### Manual re-render demo

```tsx
import { useState } from 'react';
import { useComponentLifecycle } from 'react-perf-hooks';

function Child() {
  const { aliveMs } = useComponentLifecycle('Child');
  return <p>Alive for {aliveMs.toFixed(1)} ms</p>;
}

function Parent() {
  const [tick, setTick] = useState(0);
  return (
    <section>
      <button onClick={() => setTick((value) => value + 1)}>Re-render child</button>
      <span>Tick: {tick}</span>
      <Child />
    </section>
  );
}
```

`aliveMs` updates when the component renders. If you need continuous updates, trigger re-renders with your own interval or animation state.

## TypeScript interface

```ts
interface ComponentLifecycleInfo {
  mountedAt: number;
  aliveMs: number;
}
```
