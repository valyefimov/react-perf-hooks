import { useCallback, useEffect, useRef, useState } from 'react';

export type INPRating = 'good' | 'needs-improvement' | 'poor';

export interface INPMetric {
  /** Always `INP` for easy analytics payloads. */
  name: 'INP';
  /** Interaction to Next Paint latency in milliseconds. */
  value: number;
  /** Google's INP rating thresholds: good < 200ms, poor > 500ms. */
  rating: INPRating;
  /** Event type that produced the current worst interaction. */
  eventType: string;
  /** Absolute event start time in milliseconds from navigation start. */
  startTime: number;
  /** Event interactionId when the browser exposes one. */
  interactionId: number | null;
  /** Time when this hook converted the browser entry into state. */
  timestamp: number;
}

export interface UseINPOptions {
  /**
   * Called whenever the page's worst interaction changes.
   * Use this for analytics or dev overlays.
   */
  onMetric?: (metric: INPMetric) => void;
  /**
   * Minimum event duration observed by the browser. Lower values can capture
   * more interactions but may add overhead. Defaults to `40`.
   */
  durationThreshold?: number;
  /**
   * Set to `false` to disable the observer entirely.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseINPReturn {
  /** The worst INP metric seen so far, or `null` until the first qualifying interaction. */
  metric: INPMetric | null;
  /** Convenience value from `metric.value`. */
  value: number | null;
  /** Convenience value from `metric.rating`. */
  rating: INPRating | null;
  /** Whether this browser can observe Event Timing entries. */
  isSupported: boolean;
}

interface PerformanceEventTimingLike extends PerformanceEntry {
  interactionId?: number;
}

interface PerformanceObserverEntryListLike {
  getEntries: () => PerformanceEntry[];
}

type PerformanceObserverCallbackLike = (
  list: PerformanceObserverEntryListLike,
  observer: PerformanceObserver,
) => void;

type PerformanceObserverConstructorLike = {
  new (callback: PerformanceObserverCallbackLike): PerformanceObserver;
  supportedEntryTypes?: readonly string[];
};

const DEFAULT_DURATION_THRESHOLD = 40;
const INP_GOOD_THRESHOLD = 200;
const INP_POOR_THRESHOLD = 500;

function getINPRating(value: number): INPRating {
  if (value < INP_GOOD_THRESHOLD) return 'good';
  if (value <= INP_POOR_THRESHOLD) return 'needs-improvement';
  return 'poor';
}

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function supportsEventTiming(): boolean {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return false;
  }

  const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
  return (
    Array.isArray(Observer.supportedEntryTypes) && Observer.supportedEntryTypes.includes('event')
  );
}

function toINPMetric(entry: PerformanceEventTimingLike): INPMetric {
  return {
    name: 'INP',
    value: entry.duration,
    rating: getINPRating(entry.duration),
    eventType: entry.name,
    startTime: entry.startTime,
    interactionId:
      typeof entry.interactionId === 'number' && entry.interactionId > 0
        ? entry.interactionId
        : null,
    timestamp: getNow(),
  };
}

/**
 * Tracks Interaction to Next Paint (INP) from native Event Timing entries.
 * The hook keeps the worst observed interaction for the current page view and
 * updates when a click, tap, or key interaction takes longer than the current worst value.
 *
 * @example
 * function INPBadge() {
 *   const { value, rating } = useINP();
 *
 *   return <span>INP: {value ? `${value.toFixed(0)} ms (${rating})` : 'waiting'}</span>;
 * }
 */
export function useINP(options: UseINPOptions = {}): UseINPReturn {
  const { onMetric, durationThreshold = DEFAULT_DURATION_THRESHOLD, enabled = true } = options;
  const [metric, setMetric] = useState<INPMetric | null>(null);
  const worstValueRef = useRef(0);
  const onMetricRef = useRef(onMetric);
  const isSupported = supportsEventTiming();

  useEffect(() => {
    onMetricRef.current = onMetric;
  }, [onMetric]);

  const updateMetric = useCallback((entry: PerformanceEventTimingLike) => {
    if (entry.duration <= worstValueRef.current) return;

    const nextMetric = toINPMetric(entry);
    worstValueRef.current = nextMetric.value;
    setMetric(nextMetric);
    onMetricRef.current?.(nextMetric);
  }, []);

  useEffect(() => {
    if (!enabled || !isSupported) return;

    const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        const eventEntry = entry as PerformanceEventTimingLike;
        if (typeof eventEntry.interactionId !== 'number' || eventEntry.interactionId <= 0) continue;

        updateMetric(eventEntry);
      }
    });

    observer.observe({
      type: 'event',
      buffered: true,
      durationThreshold,
    } as PerformanceObserverInit);

    return () => observer.disconnect();
  }, [durationThreshold, enabled, isSupported, updateMetric]);

  return {
    metric,
    value: metric?.value ?? null,
    rating: metric?.rating ?? null,
    isSupported,
  };
}
