import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type PerfMetricAttribution = unknown;

export type PerfMetricsReporter = (
  metricName: string,
  value: number,
  attribution?: PerfMetricAttribution,
) => void;

export interface PerfContextValue {
  /** Reports a metric to the nearest `PerfProvider`. */
  reportMetric: PerfMetricsReporter;
}

const PerfContext = createContext<PerfContextValue | null>(null);

export interface PerfProviderProps {
  /**
   * Called whenever a metric bubbles up from a hook rendered under this provider.
   * Use this to forward metrics to an analytics aggregator (Sentry, Datadog, GA4, ...).
   */
  onMetricsReport: PerfMetricsReporter;
  children?: ReactNode;
}

/**
 * Centralized collector for performance metrics emitted by hooks like `useINP`,
 * `useCLS`, and `useLongTasks`. Hooks rendered under a `PerfProvider` automatically
 * bubble their metrics to `onMetricsReport` in addition to their own local callbacks.
 * When no `PerfProvider` is present, hooks fall back to local-only execution.
 *
 * @example
 * function App() {
 *   return (
 *     <PerfProvider
 *       onMetricsReport={(metricName, value, attribution) => {
 *         navigator.sendBeacon('/analytics', JSON.stringify({ metricName, value, attribution }));
 *       }}
 *     >
 *       <MyApplication />
 *     </PerfProvider>
 *   );
 * }
 */
export function PerfProvider({ onMetricsReport, children }: PerfProviderProps) {
  const value = useMemo<PerfContextValue>(
    () => ({
      reportMetric: (metricName, metricValue, attribution) =>
        onMetricsReport(metricName, metricValue, attribution),
    }),
    [onMetricsReport],
  );

  return <PerfContext.Provider value={value}>{children}</PerfContext.Provider>;
}

/** Reads the nearest `PerfProvider` context, or `null` when none is present. */
export function usePerfContext(): PerfContextValue | null {
  return useContext(PerfContext);
}
