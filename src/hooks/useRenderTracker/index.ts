import { useMemo } from 'react';

export interface RenderInfo {
  /** Total number of times the component has rendered */
  count: number;
  /** Timestamp (ms) of the most recent render via performance.now() */
  lastRenderTime: number;
}

export interface UseRenderTrackerOptions {
  /** Display name used in log/warn messages. Default: "Component" */
  name?: string;
  /**
   * Enable tracking. Defaults to true in development, false in production.
   * Pass `true` to force-enable in production (e.g. for debugging deploys).
   */
  enabled?: boolean;
  /**
   * Emit a console.warn when the render count reaches this threshold.
   * Useful for catching components that re-render too frequently.
   */
  warnAt?: number;
}

type RenderTrackerState = {
  renderCount: number;
  prevProps?: Record<string, unknown>;
  lastRenderTime: number;
};

function getNow(): number {
  return performance.now();
}

/**
 * Tracks how many times a component renders and logs the props that changed.
 *
 * @example
 * function MyComponent({ name, value }: Props) {
 *   const { count } = useRenderTracker({ name, value }, { name: 'MyComponent', warnAt: 10 });
 *   return <div>{name}</div>;
 * }
 */
export function useRenderTracker(
  props?: Record<string, unknown>,
  options: UseRenderTrackerOptions = {},
): RenderInfo {
  const { name = 'Component', enabled = process.env.NODE_ENV !== 'production', warnAt } = options;

  const state = useMemo<RenderTrackerState>(
    () => ({
      renderCount: 0,
      lastRenderTime: 0,
    }),
    [],
  );

  if (enabled) {
    state.renderCount += 1;
    state.lastRenderTime = getNow();

    if (props && state.prevProps) {
      const previousProps = state.prevProps;
      const changedKeys = Object.keys(props).filter(
        (key) => !Object.is(props[key], previousProps[key]),
      );

      if (changedKeys.length > 0) {
        console.log(
          `[useRenderTracker] "${name}" re-rendered (×${state.renderCount}). Changed props:`,
          changedKeys,
        );
      } else {
        console.log(
          `[useRenderTracker] "${name}" re-rendered (×${state.renderCount}). No prop changes detected (parent re-render or context/state update).`,
        );
      }
    }

    // Guard against null, NaN, Infinity, 0, negative numbers, and non-numeric types
    // before relying on warnAt to trigger the warning threshold
    if (warnAt != null && Number.isFinite(warnAt) && warnAt > 0 && state.renderCount >= warnAt) {
      console.warn(
        `[useRenderTracker] "${name}" has rendered ${state.renderCount} times! ` +
          `Consider wrapping it in React.memo() or optimising its dependencies.`,
      );
    }

    state.prevProps = props;
  }

  return {
    count: state.renderCount,
    lastRenderTime: state.lastRenderTime,
  };
}
