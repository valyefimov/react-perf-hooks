import { useCallback, useEffect, useRef, useState } from 'react';

export type CLSRating = 'good' | 'needs-improvement' | 'poor';

export interface CLSAttribution {
  /** The shifted node reported by the browser, when available. */
  node: Node | null;
  /** Node position before the shift. */
  previousRect: DOMRectReadOnly | null;
  /** Node position after the shift. */
  currentRect: DOMRectReadOnly | null;
}

export interface CLSMetric {
  /** Always `CLS` for easy analytics payloads. */
  name: 'CLS';
  /** Cumulative Layout Shift score accumulated for the observed element. */
  value: number;
  /** Delta contributed by the latest matching layout-shift entry. */
  delta: number;
  /** Google's CLS rating thresholds: good < 0.1, poor > 0.25. */
  rating: CLSRating;
  /** Absolute layout-shift start time in milliseconds from navigation start. */
  startTime: number;
  /** Whether the shift happened shortly after user input. */
  hadRecentInput: boolean;
  /** Attribution sources that matched the observed element. */
  sources: CLSAttribution[];
  /** Time when this hook converted the browser entry into state. */
  timestamp: number;
}

export interface UseCLSOptions {
  /**
   * Called whenever a matching layout shift changes the component CLS value.
   * Use this for analytics or dev overlays.
   */
  onMetric?: (metric: CLSMetric) => void;
  /**
   * Include shifts from descendants of the observed element.
   * Defaults to `true`.
   */
  includeDescendants?: boolean;
  /**
   * Ignore layout shifts that happened shortly after user input, matching
   * Core Web Vitals CLS behavior. Defaults to `true`.
   */
  ignoreRecentInput?: boolean;
  /**
   * Maximum number of matching layout-shift metrics retained in state.
   * Defaults to `50`.
   */
  maxEntries?: number;
  /**
   * Set to `false` to disable the observer entirely.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseCLSReturn<T extends Element = HTMLElement> {
  /** Attach this ref to the component root you want to inspect. */
  ref: (node: T | null) => void;
  /** Latest cumulative CLS metric for the observed element. */
  metric: CLSMetric | null;
  /** Convenience value from `metric.value`. */
  value: number;
  /** Convenience value from `metric.rating`. */
  rating: CLSRating | null;
  /** Matching layout-shift metrics retained for debugging. */
  entries: CLSMetric[];
  /** Whether this browser can observe Layout Instability entries. */
  isSupported: boolean;
}

interface LayoutShiftAttributionLike {
  node?: Node | null;
  previousRect?: DOMRectReadOnly;
  currentRect?: DOMRectReadOnly;
}

interface LayoutShiftEntryLike extends PerformanceEntry {
  value?: number;
  hadRecentInput?: boolean;
  sources?: LayoutShiftAttributionLike[];
}

interface PerformanceObserverEntryListLike {
  getEntries: () => PerformanceEntry[];
}

type PerformanceObserverCallbackLike = (list: PerformanceObserverEntryListLike, observer: PerformanceObserver) => void;

type PerformanceObserverConstructorLike = {
  new (callback: PerformanceObserverCallbackLike): PerformanceObserver;
  supportedEntryTypes?: readonly string[];
};

const DEFAULT_MAX_ENTRIES = 50;
const CLS_GOOD_THRESHOLD = 0.1;
const CLS_POOR_THRESHOLD = 0.25;

function getCLSRating(value: number): CLSRating {
  if (value < CLS_GOOD_THRESHOLD) return 'good';
  if (value <= CLS_POOR_THRESHOLD) return 'needs-improvement';
  return 'poor';
}

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function supportsLayoutShift(): boolean {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return false;
  }

  const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
  return Array.isArray(Observer.supportedEntryTypes) && Observer.supportedEntryTypes.includes('layout-shift');
}

function sourceMatchesTarget(
  source: LayoutShiftAttributionLike,
  target: Element,
  includeDescendants: boolean
): boolean {
  if (!source.node) return false;
  if (source.node === target) return true;

  return includeDescendants && target.contains(source.node);
}

function getMatchingSources(
  entry: LayoutShiftEntryLike,
  target: Element,
  includeDescendants: boolean
): CLSAttribution[] {
  return (entry.sources ?? [])
    .filter((source) => sourceMatchesTarget(source, target, includeDescendants))
    .map((source) => ({
      node: source.node ?? null,
      previousRect: source.previousRect ?? null,
      currentRect: source.currentRect ?? null,
    }));
}

function createCLSMetric(
  entry: LayoutShiftEntryLike,
  value: number,
  cumulativeValue: number,
  sources: CLSAttribution[]
): CLSMetric {
  return {
    name: 'CLS',
    value: cumulativeValue,
    delta: value,
    rating: getCLSRating(cumulativeValue),
    startTime: entry.startTime,
    hadRecentInput: Boolean(entry.hadRecentInput),
    sources,
    timestamp: getNow(),
  };
}

/**
 * Tracks Cumulative Layout Shift (CLS) for a specific component root.
 * Attach the returned `ref` to the element you want to inspect; the hook
 * accumulates layout-shift entries attributed to that node or its descendants.
 *
 * @example
 * function ProductCard() {
 *   const { ref, value, rating } = useCLS<HTMLDivElement>();
 *
 *   return (
 *     <div ref={ref}>
 *       CLS: {value.toFixed(3)} {rating}
 *     </div>
 *   );
 * }
 */
export function useCLS<T extends Element = HTMLElement>(options: UseCLSOptions = {}): UseCLSReturn<T> {
  const {
    onMetric,
    includeDescendants = true,
    ignoreRecentInput = true,
    maxEntries = DEFAULT_MAX_ENTRIES,
    enabled = true,
  } = options;
  const [target, setTarget] = useState<T | null>(null);
  const [metric, setMetric] = useState<CLSMetric | null>(null);
  const [entries, setEntries] = useState<CLSMetric[]>([]);
  const cumulativeValueRef = useRef(0);
  const targetRef = useRef<T | null>(null);
  const onMetricRef = useRef(onMetric);
  const isSupported = supportsLayoutShift();

  useEffect(() => {
    onMetricRef.current = onMetric;
  }, [onMetric]);

  const ref = useCallback((node: T | null) => {
    if (node !== targetRef.current) {
      targetRef.current = node;
      cumulativeValueRef.current = 0;
      setMetric(null);
      setEntries([]);
    }

    setTarget(node);
  }, []);

  const updateMetric = useCallback(
    (entry: LayoutShiftEntryLike, matchingSources: CLSAttribution[]) => {
      const shiftValue = typeof entry.value === 'number' ? entry.value : 0;
      if (shiftValue <= 0) return;

      cumulativeValueRef.current += shiftValue;
      const nextMetric = createCLSMetric(entry, shiftValue, cumulativeValueRef.current, matchingSources);

      setMetric(nextMetric);
      setEntries((previous) => [...previous, nextMetric].slice(-maxEntries));
      onMetricRef.current?.(nextMetric);
    },
    [maxEntries]
  );

  useEffect(() => {
    if (!enabled || !isSupported || !target) return;

    const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as LayoutShiftEntryLike;
        if (ignoreRecentInput && layoutShiftEntry.hadRecentInput) continue;

        const matchingSources = getMatchingSources(layoutShiftEntry, target, includeDescendants);
        if (matchingSources.length === 0) continue;

        updateMetric(layoutShiftEntry, matchingSources);
      }
    });

    observer.observe({
      type: 'layout-shift',
      buffered: true,
    });

    return () => observer.disconnect();
  }, [enabled, ignoreRecentInput, includeDescendants, isSupported, target, updateMetric]);

  return {
    ref,
    metric,
    value: metric?.value ?? 0,
    rating: metric?.rating ?? null,
    entries,
    isSupported,
  };
}
