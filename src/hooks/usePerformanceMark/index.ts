import { useCallback, useRef } from 'react';

export interface PerformanceMeasureResult {
  /** The name passed to `measure()` */
  name: string;
  /** Duration in milliseconds */
  duration: number;
  /** Absolute start time (ms from navigation start) */
  startTime: number;
}

export interface UsePerformanceMarkReturn {
  /**
   * Creates a named performance mark. If a namespace was provided it is
   * automatically prepended: `namespace:markName`.
   */
  mark: (markName: string) => void;
  /**
   * Measures the duration between two previously created marks and returns
   * the result. Returns `null` if the Performance API is unsupported or if
   * the marks cannot be found.
   */
  measure: (measureName: string, startMark: string, endMark?: string) => PerformanceMeasureResult | null;
  /** Clears a specific mark (or all marks when no name is given). */
  clearMarks: (markName?: string) => void;
  /** Clears a specific measure entry (or all measures when no name is given). */
  clearMeasures: (measureName?: string) => void;
  /**
   * Returns all measurements recorded during this hook's lifetime.
   * Useful for sending metrics to an analytics endpoint on unmount.
   */
  getEntries: () => PerformanceMeasureResult[];
}

const isSupported =
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.measure === 'function';

/**
 * A thin, hook-friendly wrapper around the browser Performance API.
 * Supports optional namespacing to avoid mark-name collisions across components.
 *
 * @param namespace Optional prefix applied to every mark and measure name.
 *
 * @example
 * function DataGrid() {
 *   const { mark, measure } = usePerformanceMark('DataGrid');
 *
 *   useEffect(() => {
 *     mark('render-start');
 *     return () => {
 *       mark('render-end');
 *       const result = measure('full-render', 'render-start', 'render-end');
 *       console.log(`Rendered in ${result?.duration.toFixed(2)} ms`);
 *     };
 *   }, [mark, measure]);
 *
 *   return <table>...</table>;
 * }
 */
export function usePerformanceMark(namespace?: string): UsePerformanceMarkReturn {
  const entriesRef = useRef<PerformanceMeasureResult[]>([]);
  const prefix = namespace ? `${namespace}:` : '';

  const mark = useCallback(
    (markName: string): void => {
      if (!isSupported) return;
      performance.mark(`${prefix}${markName}`);
    },
    [prefix]
  );

  const measure = useCallback(
    (measureName: string, startMark: string, endMark?: string): PerformanceMeasureResult | null => {
      if (!isSupported) return null;

      try {
        const fullMeasure = `${prefix}${measureName}`;
        const fullStart = `${prefix}${startMark}`;
        const fullEnd = endMark ? `${prefix}${endMark}` : undefined;

        performance.measure(fullMeasure, fullStart, fullEnd);

        const entries = performance.getEntriesByName(fullMeasure, 'measure');
        const last = entries[entries.length - 1];

        if (!last) return null;

        const result: PerformanceMeasureResult = {
          name: measureName,
          duration: last.duration,
          startTime: last.startTime,
        };

        entriesRef.current = [...entriesRef.current, result];
        return result;
      } catch (err) {
        console.error('[usePerformanceMark] Failed to measure:', err);
        return null;
      }
    },
    [prefix]
  );

  const clearMarks = useCallback(
    (markName?: string): void => {
      if (!isSupported) return;
      if (markName) {
        performance.clearMarks(`${prefix}${markName}`);
      } else {
        performance.clearMarks();
      }
    },
    [prefix]
  );

  const clearMeasures = useCallback(
    (measureName?: string): void => {
      if (!isSupported) return;
      if (measureName) {
        performance.clearMeasures(`${prefix}${measureName}`);
      } else {
        performance.clearMeasures();
      }
    },
    [prefix]
  );

  const getEntries = useCallback((): PerformanceMeasureResult[] => {
    return entriesRef.current;
  }, []);

  return { mark, measure, clearMarks, clearMeasures, getEntries };
}
