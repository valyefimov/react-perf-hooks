import { useRef } from 'react';

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

/**
 * Tracks how many times a component renders and logs the props that changed.
 *
 * @example
 * function MyComponent({ name, value }: Props) {
 *   const { count } = useRenderTracker({ name, value }, { name: 'MyComponent', warnAt: 10 });
 *   return <div>{name}</div>;
 * }
 */
export function useRenderTracker(props?: Record<string, unknown>, options: UseRenderTrackerOptions = {}): RenderInfo {
  const { name = 'Component', enabled = process.env.NODE_ENV !== 'production', warnAt } = options;

  const renderCount = useRef(0);
  const prevProps = useRef<Record<string, unknown> | undefined>(undefined);
  const lastRenderTime = useRef(0);

  if (enabled) {
    renderCount.current += 1;
    lastRenderTime.current = performance.now();

    if (props && prevProps.current) {
      const changedKeys = Object.keys(props).filter((key) => !Object.is(props[key], prevProps.current![key]));

      if (changedKeys.length > 0) {
        console.log(`[useRenderTracker] "${name}" re-rendered (×${renderCount.current}). Changed props:`, changedKeys);
      } else {
        console.log(
          `[useRenderTracker] "${name}" re-rendered (×${renderCount.current}). No prop changes detected (parent re-render or context/state update).`
        );
      }
    }

    if (
      warnAt != null &&
      Number.isFinite(warnAt) &&
      warnAt > 0 &&
      renderCount.current >= warnAt
    ) {
      console.warn(
        `[useRenderTracker] "${name}" has rendered ${renderCount.current} times! ` +
          `Consider wrapping it in React.memo() or optimising its dependencies.`
      );
    }

    prevProps.current = props;
  }

  return {
    count: renderCount.current,
    lastRenderTime: lastRenderTime.current,
  };
}
