import { useCallback, useEffect, useRef, useState } from 'react';

export interface IntersectionObserverMetrics {
  /** Timestamp in ms since page load when the target first became visible */
  firstVisibleAt: number | null;
  /** Total accumulated visible time in ms across all visible sessions */
  totalVisibleMs: number;
}

export interface UseIntersectionObserverReturn<T extends Element = Element> {
  /** Callback ref to attach to the observed element */
  ref: (node: T | null) => void;
  /** Whether the target is currently visible within the observer root */
  isVisible: boolean;
  /** Built-in visibility timing metrics for analytics and performance reporting */
  metrics: IntersectionObserverMetrics;
}

const INITIAL_METRICS: IntersectionObserverMetrics = {
  firstVisibleAt: null,
  totalVisibleMs: 0,
};

function clampThreshold(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function getVisibilityThreshold(threshold: IntersectionObserverInit['threshold']): number {
  if (Array.isArray(threshold)) {
    const thresholds = threshold.filter((value) => Number.isFinite(value)).map(clampThreshold);
    return thresholds.length > 0 ? Math.min(...thresholds) : 0;
  }

  return typeof threshold === 'number' ? clampThreshold(threshold) : 0;
}

function getNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function isEntryVisible(entry: IntersectionObserverEntry, visibilityThreshold: number): boolean {
  if (!entry.isIntersecting) return false;
  if (visibilityThreshold <= 0) return true;
  return entry.intersectionRatio >= visibilityThreshold;
}

/**
 * Observes an element's visibility and captures timing metrics that matter for
 * lazy loading, LCP analysis, and engagement reporting.
 */
export function useIntersectionObserver<T extends Element = Element>(
  options: IntersectionObserverInit = {}
): UseIntersectionObserverReturn<T> {
  const { root = null, rootMargin, threshold } = options;
  const [target, setTarget] = useState<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<IntersectionObserverMetrics>(INITIAL_METRICS);
  const isVisibleRef = useRef(false);
  const visibleSinceRef = useRef<number | null>(null);
  const visibilityThreshold = getVisibilityThreshold(threshold);

  const ref = useCallback((node: T | null): void => {
    setTarget(node);
  }, []);

  const commitVisibleDuration = useCallback((endTime: number): void => {
    if (visibleSinceRef.current === null) return;

    const duration = Math.max(0, endTime - visibleSinceRef.current);
    visibleSinceRef.current = null;

    if (duration === 0) return;

    setMetrics((current) => ({
      ...current,
      totalVisibleMs: current.totalVisibleMs + duration,
    }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || target === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        const nextVisible = isEntryVisible(entry, visibilityThreshold);
        if (nextVisible === isVisibleRef.current) return;

        isVisibleRef.current = nextVisible;

        if (nextVisible) {
          visibleSinceRef.current = entry.time;
          setIsVisible(true);
          setMetrics((current) => {
            if (current.firstVisibleAt !== null) return current;

            return {
              ...current,
              firstVisibleAt: entry.time,
            };
          });
          return;
        }

        setIsVisible(false);
        commitVisibleDuration(entry.time);
      },
      { root, rootMargin, threshold }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      setIsVisible(false);

      if (isVisibleRef.current) {
        isVisibleRef.current = false;
        commitVisibleDuration(getNow());
      }
    };
  }, [target, root, rootMargin, threshold, visibilityThreshold, commitVisibleDuration]);

  return { ref, isVisible, metrics };
}
