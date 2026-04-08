import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface UseThrottledStateOptions {
  /** Apply the first update in a throttle window immediately. Default: true */
  leading?: boolean;
  /** Apply the latest queued update when the throttle window closes. Default: true */
  trailing?: boolean;
}

export interface ThrottledStateStats {
  /** Number of updates that were replaced or discarded before they could commit */
  droppedUpdates: number;
  /** Total number of times the throttled setter was called */
  totalUpdates: number;
}

export type UseThrottledStateReturn<T> = [T, Dispatch<SetStateAction<T>>, ThrottledStateStats];

function resolveStateAction<T>(next: SetStateAction<T>, previousValue: T): T {
  if (typeof next === 'function') {
    return (next as (prevState: T) => T)(previousValue);
  }

  return next;
}

/**
 * A throttled alternative to `useState` with built-in profiling counters.
 * The first update in a window can commit immediately (`leading`) and the
 * latest pending update can commit when the window closes (`trailing`).
 */
export function useThrottledState<T>(
  initialState: T | (() => T),
  interval = 100,
  options: UseThrottledStateOptions = {}
): UseThrottledStateReturn<T> {
  const leading = options.leading ?? true;
  const trailing = options.trailing ?? true;

  if (!leading && !trailing) {
    throw new Error('[useThrottledState] At least one of `leading` or `trailing` must be true.');
  }

  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef(state);
  const queuedValueRef = useRef(state);
  const hasQueuedValueRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowStartRef = useRef<number | null>(null);
  const intervalRef = useRef(interval);
  const optionsRef = useRef({ leading, trailing });
  const [stats, setStats] = useState<ThrottledStateStats>({
    droppedUpdates: 0,
    totalUpdates: 0,
  });
  const statsRef = useRef<ThrottledStateStats>({
    droppedUpdates: 0,
    totalUpdates: 0,
  });

  useEffect(() => {
    intervalRef.current = interval;
  }, [interval]);

  useEffect(() => {
    optionsRef.current = { leading, trailing };
  }, [leading, trailing]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      windowStartRef.current = null;
      hasQueuedValueRef.current = false;
    };
  }, []);

  const flushStats = useCallback(() => {
    const nextStats = { ...statsRef.current };

    setStats((currentStats) => {
      if (
        currentStats.droppedUpdates === nextStats.droppedUpdates &&
        currentStats.totalUpdates === nextStats.totalUpdates
      ) {
        return currentStats;
      }

      return nextStats;
    });
  }, []);

  const commitValue = useCallback(
    (nextValue: T) => {
      hasQueuedValueRef.current = false;
      queuedValueRef.current = nextValue;

      if (!Object.is(stateRef.current, nextValue)) {
        stateRef.current = nextValue;
        setState(nextValue);
      }

      flushStats();
    },
    [flushStats]
  );

  const scheduleWindow = useCallback(
    (delay: number) => {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        windowStartRef.current = null;

        if (optionsRef.current.trailing && hasQueuedValueRef.current) {
          commitValue(queuedValueRef.current);
          return;
        }

        hasQueuedValueRef.current = false;
        flushStats();
      }, delay);
    },
    [commitValue, flushStats]
  );

  const setThrottledState: Dispatch<SetStateAction<T>> = useCallback(
    (next) => {
      statsRef.current.totalUpdates += 1;

      const nextInterval = intervalRef.current;
      const baseValue = hasQueuedValueRef.current ? queuedValueRef.current : stateRef.current;

      if (nextInterval <= 0) {
        const resolvedValue = resolveStateAction(next, baseValue);
        commitValue(resolvedValue);
        return;
      }

      const now = Date.now();
      const isWindowActive = windowStartRef.current !== null;

      if (!isWindowActive) {
        windowStartRef.current = now;
        scheduleWindow(nextInterval);

        const resolvedValue = resolveStateAction(next, baseValue);
        if (optionsRef.current.leading) {
          commitValue(resolvedValue);
        } else {
          queuedValueRef.current = resolvedValue;
          hasQueuedValueRef.current = true;
        }

        return;
      }

      if (!optionsRef.current.trailing) {
        statsRef.current.droppedUpdates += 1;
        return;
      }

      const resolvedValue = resolveStateAction(next, baseValue);
      if (hasQueuedValueRef.current) {
        statsRef.current.droppedUpdates += 1;
      }

      queuedValueRef.current = resolvedValue;
      hasQueuedValueRef.current = true;
    },
    [commitValue, scheduleWindow]
  );

  return [state, setThrottledState, stats];
}
