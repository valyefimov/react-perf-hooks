import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export interface DebouncedStateStats {
  /** Number of pending debounced updates replaced before they could trigger a render */
  skippedRenders: number;
  /** Total number of times the debounced setter was called */
  totalUpdates: number;
}

export type UseDebouncedStateReturn<T> = [T, Dispatch<SetStateAction<T>>, DebouncedStateStats];

function resolveStateAction<T>(next: SetStateAction<T>, previousValue: T): T {
  if (typeof next === 'function') {
    return (next as (prevState: T) => T)(previousValue);
  }

  return next;
}

/**
 * A debounced alternative to `useState` with built-in profiling counters.
 * Each incoming update resets the timer; if a pending update is replaced,
 * `stats.skippedRenders` is incremented.
 */
export function useDebouncedState<T>(initialState: T | (() => T), delay = 300): UseDebouncedStateReturn<T> {
  const [state, setState] = useState<T>(initialState);
  const stateRef = useRef(state);
  const queuedValueRef = useRef(state);
  const hasQueuedValueRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayRef = useRef(delay);
  const [stats, setStats] = useState<DebouncedStateStats>({
    skippedRenders: 0,
    totalUpdates: 0,
  });
  const statsRef = useRef(stats);

  useEffect(() => {
    delayRef.current = delay;
  }, [delay]);

  useEffect(() => {
    stateRef.current = state;

    if (hasQueuedValueRef.current && Object.is(queuedValueRef.current, state)) {
      hasQueuedValueRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const setDebouncedState: Dispatch<SetStateAction<T>> = useCallback((next) => {
    statsRef.current.totalUpdates += 1;

    const baseValue = hasQueuedValueRef.current ? queuedValueRef.current : stateRef.current;
    const resolvedValue = resolveStateAction(next, baseValue);

    queuedValueRef.current = resolvedValue;
    hasQueuedValueRef.current = true;

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      statsRef.current.skippedRenders += 1;
    }

    const nextDelay = delayRef.current;
    if (nextDelay <= 0) {
      setState(resolvedValue);
      setStats({ ...statsRef.current });
      return;
    }

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setState(queuedValueRef.current);
      setStats({ ...statsRef.current });
    }, nextDelay);
  }, []);

  return [state, setDebouncedState, stats];
}
