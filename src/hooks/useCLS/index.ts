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
  /** Largest CLS session-window score for the observed element. */
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
  /** Latest CLS metric for the observed element, scored by largest session window. */
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
const CLS_SESSION_GAP_LIMIT = 1000;
const CLS_SESSION_WINDOW_LIMIT = 5000;

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

function getRectKey(rect?: DOMRectReadOnly): string {
  if (!rect) return '';

  return `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
}

function getLayoutShiftEntryKey(entry: LayoutShiftEntryLike): string {
  const sourceKeys = (entry.sources ?? [])
    .map((source) => {
      const nodeName = source.node instanceof Element ? source.node.tagName : source.node?.nodeName;
      return `${nodeName ?? 'unknown'}:${getRectKey(source.previousRect)}:${getRectKey(source.currentRect)}`;
    })
    .join('|');

  return `${entry.startTime}:${entry.value ?? 0}:${Boolean(entry.hadRecentInput)}:${sourceKeys}`;
}

/**
 * Tracks Cumulative Layout Shift (CLS) for a specific component root.
 * Attach the returned `ref` to the element you want to inspect; the hook
 * reports the largest CLS session window attributed to that node or its descendants.
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
  const currentValueRef = useRef(0);
  const sessionValueRef = useRef(0);
  const sessionStartTimeRef = useRef(0);
  const sessionLastEntryTimeRef = useRef(0);
  const processedEntryKeysRef = useRef<Set<string>>(new Set());
  const targetRef = useRef<T | null>(null);
  const onMetricRef = useRef(onMetric);
  const includeDescendantsRef = useRef(includeDescendants);
  const ignoreRecentInputRef = useRef(ignoreRecentInput);
  const maxEntriesRef = useRef(maxEntries);
  const isSupported = supportsLayoutShift();

  useEffect(() => {
    onMetricRef.current = onMetric;
  }, [onMetric]);

  useEffect(() => {
    includeDescendantsRef.current = includeDescendants;
  }, [includeDescendants]);

  useEffect(() => {
    ignoreRecentInputRef.current = ignoreRecentInput;
  }, [ignoreRecentInput]);

  useEffect(() => {
    maxEntriesRef.current = maxEntries;
  }, [maxEntries]);

  const ref = useCallback((node: T | null) => {
    if (node !== targetRef.current) {
      targetRef.current = node;
      currentValueRef.current = 0;
      sessionValueRef.current = 0;
      sessionStartTimeRef.current = 0;
      sessionLastEntryTimeRef.current = 0;
      processedEntryKeysRef.current.clear();
      setMetric(null);
      setEntries([]);
    }

    setTarget(node);
  }, []);

  const updateMetric = useCallback(
    (entry: LayoutShiftEntryLike, matchingSources: CLSAttribution[]) => {
      const shiftValue = typeof entry.value === 'number' ? entry.value : 0;
      if (shiftValue <= 0) return;

      const isSameSession =
        sessionValueRef.current > 0 &&
        entry.startTime - sessionLastEntryTimeRef.current < CLS_SESSION_GAP_LIMIT &&
        entry.startTime - sessionStartTimeRef.current < CLS_SESSION_WINDOW_LIMIT;

      if (isSameSession) {
        sessionValueRef.current += shiftValue;
      } else {
        sessionValueRef.current = shiftValue;
        sessionStartTimeRef.current = entry.startTime;
      }

      sessionLastEntryTimeRef.current = entry.startTime;

      const previousValue = currentValueRef.current;
      currentValueRef.current = Math.max(currentValueRef.current, sessionValueRef.current);
      const nextMetric = createCLSMetric(entry, shiftValue, currentValueRef.current, matchingSources);

      setMetric(nextMetric);
      setEntries((previous) => [...previous, nextMetric].slice(-maxEntriesRef.current));
      if (currentValueRef.current > previousValue) {
        onMetricRef.current?.(nextMetric);
      }
    },
    []
  );

  useEffect(() => {
    if (!enabled || !isSupported || !target) return;

    const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as LayoutShiftEntryLike;
        const entryKey = getLayoutShiftEntryKey(layoutShiftEntry);
        if (processedEntryKeysRef.current.has(entryKey)) continue;

        if (ignoreRecentInputRef.current && layoutShiftEntry.hadRecentInput) continue;

        const matchingSources = getMatchingSources(layoutShiftEntry, target, includeDescendantsRef.current);
        if (matchingSources.length === 0) continue;

        processedEntryKeysRef.current.add(entryKey);
        updateMetric(layoutShiftEntry, matchingSources);
      }
    });

    observer.observe({
      type: 'layout-shift',
      buffered: true,
    });

    return () => observer.disconnect();
  }, [enabled, isSupported, target, updateMetric]);

  return {
    ref,
    metric,
    value: metric?.value ?? 0,
    rating: metric?.rating ?? null,
    entries,
    isSupported,
  };
}
