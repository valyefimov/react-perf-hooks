import { useCallback, useEffect, useRef, useState } from 'react';

export interface LongTaskAttribution {
  /** Attribution name reported by the browser. */
  name: string;
  /** Frame/container type, when exposed by the browser. */
  containerType: string;
  /** Container source URL, when exposed by the browser. */
  containerSrc: string;
  /** Container DOM id, when exposed by the browser. */
  containerId: string;
  /** Container name, when exposed by the browser. */
  containerName: string;
}

export interface LongTaskMetric {
  /** Always `longtask` for easy analytics payloads. */
  name: 'longtask';
  /** Long task duration in milliseconds. */
  duration: number;
  /** Time above the 50ms long-task budget. */
  blockingTime: number;
  /** Absolute task start time in milliseconds from navigation start. */
  startTime: number;
  /** App screen, route, or view name supplied through `screen`. */
  screen: string | null;
  /** Browser task attribution data, when available. */
  attribution: LongTaskAttribution[];
  /** Time when this hook converted the browser entry into state. */
  timestamp: number;
}

export interface UseLongTasksOptions {
  /**
   * Called whenever a matching long task is observed.
   * Use this for analytics, dev overlays, or route-level freeze logging.
   */
  onLongTask?: (metric: LongTaskMetric) => void;
  /**
   * Current screen, route, or view name. A function is useful when a router can
   * change location without remounting the component that owns this observer.
   */
  screen?: string | (() => string | null | undefined) | null;
  /**
   * Minimum task duration retained by the hook. Browser longtask entries are
   * already >= 50ms; this can raise the reporting threshold. Defaults to `50`.
   */
  minDuration?: number;
  /**
   * Maximum number of long-task metrics retained in state.
   * Defaults to `50`.
   */
  maxEntries?: number;
  /**
   * Set to `false` to disable the observer entirely.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseLongTasksReturn {
  /** Latest long task, or `null` until the first matching task is observed. */
  latest: LongTaskMetric | null;
  /** Retained long-task metrics for debugging and overlays. */
  entries: LongTaskMetric[];
  /** Number of retained long tasks. */
  count: number;
  /** Sum of retained `blockingTime` values. */
  totalBlockingTime: number;
  /** Whether this browser can observe Long Tasks entries. */
  isSupported: boolean;
}

interface TaskAttributionTimingLike {
  name?: string;
  containerType?: string;
  containerSrc?: string;
  containerId?: string;
  containerName?: string;
}

interface LongTaskEntryLike extends PerformanceEntry {
  attribution?: TaskAttributionTimingLike[];
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

const DEFAULT_MIN_DURATION = 50;
const DEFAULT_MAX_ENTRIES = 50;
const LONG_TASK_BUDGET = 50;
const MAX_PROCESSED_ENTRY_KEYS = 1000;

const processedEntryKeys = new Set<string>();
const processedEntryKeyQueue: string[] = [];

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function supportsLongTasks(): boolean {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return false;
  }

  const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
  return (
    Array.isArray(Observer.supportedEntryTypes) && Observer.supportedEntryTypes.includes('longtask')
  );
}

function normalizeAttribution(entry: LongTaskEntryLike): LongTaskAttribution[] {
  return (entry.attribution ?? []).map((item) => ({
    name: item.name ?? '',
    containerType: item.containerType ?? '',
    containerSrc: item.containerSrc ?? '',
    containerId: item.containerId ?? '',
    containerName: item.containerName ?? '',
  }));
}

function getAttributionKey(entry: LongTaskEntryLike): string {
  return (entry.attribution ?? [])
    .map(
      (item) =>
        `${item.name ?? ''}:${item.containerType ?? ''}:${item.containerSrc ?? ''}:${item.containerId ?? ''}:${
          item.containerName ?? ''
        }`,
    )
    .join('|');
}

function getLongTaskEntryKey(entry: LongTaskEntryLike): string {
  return `${entry.name}:${entry.startTime}:${entry.duration}:${getAttributionKey(entry)}`;
}

function markEntryProcessed(entry: LongTaskEntryLike): boolean {
  const key = getLongTaskEntryKey(entry);
  if (processedEntryKeys.has(key)) return false;

  processedEntryKeys.add(key);
  processedEntryKeyQueue.push(key);

  while (processedEntryKeyQueue.length > MAX_PROCESSED_ENTRY_KEYS) {
    const oldestKey = processedEntryKeyQueue.shift();
    if (oldestKey) {
      processedEntryKeys.delete(oldestKey);
    }
  }

  return true;
}

function resolveScreen(screen: UseLongTasksOptions['screen']): string | null {
  const value = typeof screen === 'function' ? screen() : screen;
  return value ?? null;
}

function toLongTaskMetric(entry: LongTaskEntryLike, screen: string | null): LongTaskMetric {
  return {
    name: 'longtask',
    duration: entry.duration,
    blockingTime: Math.max(0, entry.duration - LONG_TASK_BUDGET),
    startTime: entry.startTime,
    screen,
    attribution: normalizeAttribution(entry),
    timestamp: getNow(),
  };
}

function retainLatestEntries(
  current: LongTaskMetric[],
  metric: LongTaskMetric,
  maxEntries: number,
): LongTaskMetric[] {
  const normalizedMaxEntries = Number.isFinite(maxEntries)
    ? Math.floor(maxEntries)
    : DEFAULT_MAX_ENTRIES;
  const maxRetainedEntries = Math.max(0, normalizedMaxEntries);
  if (maxRetainedEntries === 0) return [];

  return [...current, metric].slice(-maxRetainedEntries);
}

/**
 * Tracks browser Long Tasks, i.e. main-thread work that blocks for more than 50ms.
 * Use it to log when and on which screen the app freezes during a page view.
 *
 * @example
 * function AppPerfProbe() {
 *   useLongTasks({
 *     screen: () => location.pathname,
 *     onLongTask: (task) => navigator.sendBeacon('/analytics/long-task', JSON.stringify(task)),
 *   });
 *
 *   return null;
 * }
 */
export function useLongTasks(options: UseLongTasksOptions = {}): UseLongTasksReturn {
  const {
    onLongTask,
    screen = null,
    minDuration = DEFAULT_MIN_DURATION,
    maxEntries = DEFAULT_MAX_ENTRIES,
    enabled = true,
  } = options;
  const [entries, setEntries] = useState<LongTaskMetric[]>([]);
  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const isSupported = supportsLongTasks();
  const onLongTaskRef = useRef(onLongTask);
  const screenRef = useRef(screen);
  const minDurationRef = useRef(minDuration);
  const maxEntriesRef = useRef(maxEntries);

  useEffect(() => {
    onLongTaskRef.current = onLongTask;
    screenRef.current = screen;
    minDurationRef.current = minDuration;
    maxEntriesRef.current = maxEntries;
  }, [maxEntries, minDuration, onLongTask, screen]);

  const handleEntry = useCallback((entry: LongTaskEntryLike) => {
    if (entry.duration < minDurationRef.current) return;
    if (!markEntryProcessed(entry)) return;

    const metric = toLongTaskMetric(entry, resolveScreen(screenRef.current));

    setEntries((current) => retainLatestEntries(current, metric, maxEntriesRef.current));
    onLongTaskRef.current?.(metric);
  }, []);

  useEffect(() => {
    if (!enabled || !isSupported) return;

    const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        handleEntry(entry as LongTaskEntryLike);
      }
    });

    observer.observe({
      type: 'longtask',
      buffered: true,
    } as PerformanceObserverInit);

    return () => observer.disconnect();
  }, [enabled, handleEntry, isSupported]);

  return {
    latest,
    entries,
    count: entries.length,
    totalBlockingTime: entries.reduce((total, entry) => total + entry.blockingTime, 0),
    isSupported,
  };
}
