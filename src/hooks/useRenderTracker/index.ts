import { useEffect, useId } from 'react';

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
  count: number;
  lastRenderTime: number;
  prevProps?: Record<string, unknown>;
};

const trackerStates = new Map<string, RenderTrackerState>();

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

  const instanceId = useId();
  let state = trackerStates.get(instanceId);

  if (!state) {
    state = {
      count: 0,
      lastRenderTime: 0,
    };
    trackerStates.set(instanceId, state);
  }

  if (enabled) {
    state.count += 1;
    state.lastRenderTime = getNow();

    if (props && state.prevProps) {
      const previousProps = state.prevProps;
      const changedKeys = Object.keys(props).filter(
        (key) => !Object.is(props[key], previousProps[key]),
      );

      if (changedKeys.length > 0) {
        console.log(
          `[useRenderTracker] "${name}" re-rendered (×${state.count}). Changed props:`,
          changedKeys,
        );
      } else {
        console.log(
          `[useRenderTracker] "${name}" re-rendered (×${state.count}). No prop changes detected (parent re-render or context/state update).`,
        );
      }
    }

    // Guard against null, NaN, Infinity, 0, negative numbers, and non-numeric types
    // before relying on warnAt to trigger the warning threshold
    if (warnAt != null && Number.isFinite(warnAt) && warnAt > 0 && state.count >= warnAt) {
      console.warn(
        `[useRenderTracker] "${name}" has rendered ${state.count} times! ` +
          `Consider wrapping it in React.memo() or optimising its dependencies.`,
      );
    }

    state.prevProps = props;
  }

  const renderInfo = {
    count: state.count,
    lastRenderTime: state.lastRenderTime,
  };

  useEffect(() => {
    return () => {
      trackerStates.delete(instanceId);
    };
  }, [instanceId]);

  return {
    count: renderInfo.count,
    lastRenderTime: renderInfo.lastRenderTime,
  };
}
