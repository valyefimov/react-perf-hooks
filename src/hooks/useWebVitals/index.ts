import { useState, useEffect, useCallback } from 'react';

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalMetric {
  /** Metric name (CLS, LCP, INP, FCP, TTFB) */
  name: string;
  /** Metric value in the unit native to the metric (ms or unitless score) */
  value: number;
  /** Google's rating threshold for this metric */
  rating: VitalRating;
  /**
   * Delta from the previous report. On the first report this equals `value`.
   * Useful when sending incremental updates to an analytics endpoint.
   */
  delta: number;
  /** Unique ID for deduplication when multiple reports arrive */
  id: string;
}

export interface WebVitalsState {
  /** Cumulative Layout Shift — threshold: good < 0.1, poor > 0.25 */
  CLS: WebVitalMetric | null;
  /** Largest Contentful Paint (ms) — threshold: good < 2500, poor > 4000 */
  LCP: WebVitalMetric | null;
  /** Interaction to Next Paint (ms) — threshold: good < 200, poor > 500 */
  INP: WebVitalMetric | null;
  /** First Contentful Paint (ms) — threshold: good < 1800, poor > 3000 */
  FCP: WebVitalMetric | null;
  /** Time to First Byte (ms) — threshold: good < 800, poor > 1800 */
  TTFB: WebVitalMetric | null;
}

export interface UseWebVitalsOptions {
  /**
   * Called each time a metric is updated. Ideal for reporting to analytics:
   * ```ts
   * onMetric: (metric) => sendToAnalytics('/vitals', metric)
   * ```
   */
  onMetric?: (metric: WebVitalMetric) => void;
  /**
   * Set to `false` to disable the hook entirely (e.g. during SSR or tests).
   * Defaults to `true`.
   */
  enabled?: boolean;
}

const INITIAL_STATE: WebVitalsState = {
  CLS: null,
  LCP: null,
  INP: null,
  FCP: null,
  TTFB: null,
};

/**
 * Subscribes to all five Core Web Vitals and exposes them as reactive state.
 * Relies on the `web-vitals` package (optional peer dependency).
 * Falls back gracefully with a console.warn if it is not installed.
 *
 * @example
 * function App() {
 *   const vitals = useWebVitals({
 *     onMetric: (m) => fetch('/analytics', { method: 'POST', body: JSON.stringify(m) }),
 *   });
 *
 *   return (
 *     <div>
 *       <p>LCP: {vitals.LCP?.value ?? '…'} ms — {vitals.LCP?.rating}</p>
 *       <p>CLS: {vitals.CLS?.value ?? '…'} — {vitals.CLS?.rating}</p>
 *     </div>
 *   );
 * }
 */
export function useWebVitals(options: UseWebVitalsOptions = {}): WebVitalsState {
  const { onMetric, enabled = true } = options;
  const [vitals, setVitals] = useState<WebVitalsState>(INITIAL_STATE);

  const handleMetric = useCallback(
    (metric: WebVitalMetric) => {
      setVitals((prev) => ({ ...prev, [metric.name]: metric }));
      onMetric?.(metric);
    },
    [onMetric]
  );

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    import('web-vitals')
      .then(({ onCLS, onLCP, onINP, onFCP, onTTFB }) => {
        onCLS(handleMetric);
        onLCP(handleMetric);
        onINP(handleMetric);
        onFCP(handleMetric);
        onTTFB(handleMetric);
      })
      .catch(() => {
        console.warn('[useWebVitals] The "web-vitals" package is not installed. ' + 'Run: npm install web-vitals');
      });
  }, [enabled, handleMetric]);

  return vitals;
}
