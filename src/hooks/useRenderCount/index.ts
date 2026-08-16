import { useId } from 'react';

export interface UseRenderCountOptions {
  /**
   * Enable tracking. Defaults to true in development, false in production.
   * Pass `true` to force-enable in production (e.g. for debugging deploys).
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

// Keyed by the per-instance id from useId rather than a ref, since reading
// (or writing) a ref's `current` during render is unsafe: React may discard
// or replay the render (e.g. Strict Mode, Suspense) without the ref mutation
// itself being replayed consistently, and the eslint-plugin-react-hooks
// "refs" rule flags exactly this. A module-level map keyed by a stable id is
// safe to read and write directly in the render body.
const renderCounts = new Map<string, number>();

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
  const {
    enabled = process.env.NODE_ENV !== 'production',
    logOnRender = false,
    thresholdWarning,
  } = options;

  const instanceId = useId();

  if (!enabled) {
    return renderCounts.get(instanceId) ?? 0;
  }

  const count = (renderCounts.get(instanceId) ?? 0) + 1;
  renderCounts.set(instanceId, count);

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
