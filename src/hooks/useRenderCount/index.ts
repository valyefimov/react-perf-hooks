import { useState } from 'react';

export interface UseRenderCountOptions {
  /**
   * Enable tracking in development. Always a no-op in production builds
   * (`process.env.NODE_ENV === 'production'`), regardless of this flag, so
   * bundlers can statically eliminate the counting logic entirely.
   */
  enabled?: boolean;
  /** Log the running count to the console on every render. Default: false */
  logOnRender?: boolean;
  /**
   * When the count reaches this value, a single `console.warn` fires flagging
   * the component as a possible thrashing hotspot. Omit to disable.
   */
  thresholdWarning?: number;
}

// Keyed by a per-instance identity object rather than a ref (reading/writing
// a ref's `current` during render is unsafe and flagged by the
// eslint-plugin-react-hooks "refs" rule) or `useId` (deterministic across SSR
// requests, so concurrent requests would collide and leak counts into each
// other's HTML). A WeakMap keyed on a unique object is GC'd automatically on
// unmount, unlike a Map keyed by a string id, which would grow forever.
const renderCounts = new WeakMap<object, number>();

/**
 * Tracks how many times a component has rendered, incremented synchronously
 * in the render body so the returned value is always current for the render
 * it's read in (no `useEffect` lag).
 *
 * Note on React Strict Mode: in development, Strict Mode invokes component
 * render bodies twice per commit to surface side-effect bugs. Since the
 * counter increments directly in the render body, each Strict Mode commit
 * bumps it twice, inflating the count relative to production. This is a
 * known, documented tradeoff of counting during render rather than in an
 * effect (which would under-count by skipping the render phase entirely).
 *
 * @example
 * function DashboardCard() {
 *   const renderCount = useRenderCount('DashboardCard', {
 *     logOnRender: true,
 *     thresholdWarning: 10,
 *   });
 *
 *   return <span>Rendered {renderCount} times</span>;
 * }
 */
export function useRenderCount(name: string, options: UseRenderCountOptions = {}): number {
  const [instanceKey] = useState<object>(() => ({}));

  if (process.env.NODE_ENV === 'production') {
    return 0;
  }

  const { enabled = true, logOnRender = false, thresholdWarning } = options;

  if (!enabled) {
    return renderCounts.get(instanceKey) ?? 0;
  }

  const count = (renderCounts.get(instanceKey) ?? 0) + 1;
  renderCounts.set(instanceKey, count);

  if (logOnRender) {
    console.log(`[useRenderCount] "${name}" rendered ${count} time${count === 1 ? '' : 's'}`);
  }

  if (thresholdWarning !== undefined && count === thresholdWarning) {
    console.warn(
      `[useRenderCount] "${name}" has rendered ${count} times, reaching the warning threshold of ${thresholdWarning}.`,
    );
  }

  return count;
}
