import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type NetworkResourceFilter =
  | string
  | RegExp
  | ((entry: PerformanceResourceTiming) => boolean);

export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | string;

export interface NetworkEfficiencyEntry {
  /** Full resource URL reported by the Resource Timing API. */
  name: string;
  /** Initiator type such as `fetch`, `xmlhttprequest`, `script`, or `img`. */
  initiatorType: string;
  /** Best available payload size in bytes. */
  payloadSize: number;
  /** Network bytes transferred, when exposed by Timing-Allow-Origin. */
  transferSize: number;
  /** Encoded body size in bytes, when exposed by Timing-Allow-Origin. */
  encodedBodySize: number;
  /** Decoded body size in bytes, when exposed by Timing-Allow-Origin. */
  decodedBodySize: number;
  /** Configured threshold after Network Information API adjustments. */
  effectiveMaxSizeInBytes: number;
  /** Network effective type, when `navigator.connection` is available. */
  effectiveType: NetworkEffectiveType | null;
  /** Whether the payload crosses the effective threshold. */
  isInefficient: boolean;
  /** Resource start time in milliseconds from navigation start. */
  startTime: number;
  /** Resource duration in milliseconds. */
  duration: number;
  /** Time when this hook converted the browser entry into state. */
  timestamp: number;
}

export interface UseNetworkEfficiencyOptions {
  /**
   * Resource matcher. A string matches by substring against the full resource
   * URL, while a RegExp is tested against it. Omit to inspect all resources.
   */
  resourceFilter?: NetworkResourceFilter;
  /**
   * Payload threshold in bytes before network conditions are applied.
   * Defaults to `512000` (500KB).
   */
  maxSizeInBytes?: number;
  /**
   * Called whenever a matching resource exceeds the effective payload threshold.
   */
  onWarning?: (entry: NetworkEfficiencyEntry) => void;
  /**
   * Set to `false` to disable resource scanning and observation.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseNetworkEfficiencyReturn {
  /** Latest matching resource payload size in bytes, or `null` before a match. */
  lastPayloadSize: number | null;
  /** Whether the latest matching resource exceeds the effective threshold. */
  isInefficient: boolean;
  /** Latest matching resource payload summary, or `null` before a match. */
  latest: NetworkEfficiencyEntry | null;
  /** Configured threshold after Network Information API adjustments. */
  effectiveMaxSizeInBytes: number;
  /** Network effective type, or `null` when unsupported/unavailable. */
  effectiveType: NetworkEffectiveType | null;
  /** Whether this browser exposes resource timing entries. */
  isSupported: boolean;
}

interface NetworkInformationLike {
  effectiveType?: NetworkEffectiveType;
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
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

interface NetworkState {
  effectiveMaxSizeInBytes: number;
  effectiveType: NetworkEffectiveType | null;
}

interface LatestNetworkResource {
  source: PerformanceResourceTiming;
  metric: NetworkEfficiencyEntry;
}

const DEFAULT_MAX_SIZE_IN_BYTES = 1024 * 500;
const MAX_TRACKED_RESOURCE_ENTRIES = 100;

const unsupportedState: UseNetworkEfficiencyReturn = {
  lastPayloadSize: null,
  isInefficient: false,
  latest: null,
  effectiveMaxSizeInBytes: DEFAULT_MAX_SIZE_IN_BYTES,
  effectiveType: null,
  isSupported: false,
};

function getNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function normalizeMaxSizeInBytes(maxSizeInBytes: number): number {
  return Number.isFinite(maxSizeInBytes) && maxSizeInBytes >= 0
    ? Math.floor(maxSizeInBytes)
    : DEFAULT_MAX_SIZE_IN_BYTES;
}

function getConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;

  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function getEffectiveMaxSizeInBytes(
  maxSizeInBytes: number,
  connection: NetworkInformationLike | null = getConnection(),
): number {
  const effectiveType = connection?.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return Math.floor(maxSizeInBytes * 0.25);
  }

  if (effectiveType === '3g') {
    return Math.floor(maxSizeInBytes * 0.5);
  }

  if (connection?.saveData) {
    return Math.floor(maxSizeInBytes * 0.5);
  }

  return maxSizeInBytes;
}

function getNetworkState(maxSizeInBytes: number): NetworkState {
  const connection = getConnection();

  return {
    effectiveMaxSizeInBytes: getEffectiveMaxSizeInBytes(maxSizeInBytes, connection),
    effectiveType: connection?.effectiveType ?? null,
  };
}

function isResourceTiming(entry: PerformanceEntry): entry is PerformanceResourceTiming {
  return entry.entryType === 'resource';
}

function supportsResourceTiming(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof performance !== 'undefined' &&
    typeof performance.getEntriesByType === 'function'
  );
}

function supportsResourceObserver(): boolean {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return false;
  }

  const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
  return (
    Array.isArray(Observer.supportedEntryTypes) && Observer.supportedEntryTypes.includes('resource')
  );
}

function matchesResourceFilter(
  entry: PerformanceResourceTiming,
  resourceFilter: NetworkResourceFilter | undefined,
): boolean {
  if (!resourceFilter) return true;

  if (typeof resourceFilter === 'string') {
    return entry.name.includes(resourceFilter);
  }

  if (resourceFilter instanceof RegExp) {
    resourceFilter.lastIndex = 0;
    return resourceFilter.test(entry.name);
  }

  return resourceFilter(entry);
}

function getResourceFilterKey(resourceFilter: NetworkResourceFilter | undefined): unknown {
  if (resourceFilter instanceof RegExp) {
    return `regexp:${resourceFilter.source}/${resourceFilter.flags}`;
  }

  return resourceFilter;
}

function getPayloadSize(entry: PerformanceResourceTiming): number {
  const sizes = [entry.transferSize, entry.encodedBodySize, entry.decodedBodySize];
  const size = sizes.find((value) => Number.isFinite(value) && value > 0);
  return size ?? 0;
}

function getResourceEntryKey(entry: PerformanceResourceTiming): string {
  return `${entry.name}:${entry.startTime}:${entry.duration}:${entry.transferSize}:${entry.encodedBodySize}:${entry.decodedBodySize}`;
}

function retainResourceEntry(
  entries: Map<string, PerformanceResourceTiming>,
  inefficientStates: Map<string, boolean>,
  key: string,
  entry: PerformanceResourceTiming,
): void {
  if (entries.get(key) === entry) return;

  entries.delete(key);
  entries.set(key, entry);

  while (entries.size > MAX_TRACKED_RESOURCE_ENTRIES) {
    const oldestKey = entries.keys().next().value;

    if (oldestKey === undefined) return;

    entries.delete(oldestKey);
    inefficientStates.delete(oldestKey);
  }
}

function toNetworkEfficiencyEntry(
  entry: PerformanceResourceTiming,
  effectiveMaxSizeInBytes: number,
  effectiveType: NetworkEffectiveType | null,
): NetworkEfficiencyEntry {
  const payloadSize = getPayloadSize(entry);

  return {
    name: entry.name,
    initiatorType: entry.initiatorType,
    payloadSize,
    transferSize: entry.transferSize,
    encodedBodySize: entry.encodedBodySize,
    decodedBodySize: entry.decodedBodySize,
    effectiveMaxSizeInBytes,
    effectiveType,
    isInefficient: payloadSize > effectiveMaxSizeInBytes,
    startTime: entry.startTime,
    duration: entry.duration,
    timestamp: getNow(),
  };
}

function areSameNetworkEfficiencyEntry(
  current: NetworkEfficiencyEntry | null,
  next: NetworkEfficiencyEntry,
): boolean {
  return (
    current?.name === next.name &&
    current.initiatorType === next.initiatorType &&
    current.payloadSize === next.payloadSize &&
    current.transferSize === next.transferSize &&
    current.encodedBodySize === next.encodedBodySize &&
    current.decodedBodySize === next.decodedBodySize &&
    current.effectiveMaxSizeInBytes === next.effectiveMaxSizeInBytes &&
    current.effectiveType === next.effectiveType &&
    current.isInefficient === next.isInefficient &&
    current.startTime === next.startTime &&
    current.duration === next.duration
  );
}

/**
 * Monitors Resource Timing entries and flags payloads that are too large for
 * the current network conditions.
 *
 * @example
 * function ApiPayloadProbe() {
 *   const { lastPayloadSize, isInefficient } = useNetworkEfficiency({
 *     resourceFilter: '/api/v1/heavy-data',
 *     maxSizeInBytes: 1024 * 500,
 *     onWarning: (entry) => console.warn('Large payload', entry),
 *   });
 *
 *   return <span>{isInefficient ? `${lastPayloadSize} bytes` : null}</span>;
 * }
 */
export function useNetworkEfficiency(
  options: UseNetworkEfficiencyOptions = {},
): UseNetworkEfficiencyReturn {
  const {
    resourceFilter,
    maxSizeInBytes = DEFAULT_MAX_SIZE_IN_BYTES,
    onWarning,
    enabled = true,
  } = options;
  const normalizedMaxSizeInBytes = normalizeMaxSizeInBytes(maxSizeInBytes);
  const [networkState, setNetworkState] = useState<NetworkState>(() =>
    getNetworkState(normalizedMaxSizeInBytes),
  );
  const { effectiveMaxSizeInBytes, effectiveType } = networkState;
  const resourceFilterKey = getResourceFilterKey(resourceFilter);
  const isSupported = supportsResourceTiming();
  const [latest, setLatest] = useState<LatestNetworkResource | null>(null);
  const processedEntriesRef = useRef(new Map<string, PerformanceResourceTiming>());
  const entryInefficientStateRef = useRef(new Map<string, boolean>());
  const resourceFilterRef = useRef(resourceFilter);
  const effectiveMaxSizeInBytesRef = useRef(effectiveMaxSizeInBytes);
  const effectiveTypeRef = useRef(effectiveType);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    const updateNetworkState = () => {
      setNetworkState(getNetworkState(normalizedMaxSizeInBytes));
    };
    const connection = getConnection();

    updateNetworkState();
    connection?.addEventListener?.('change', updateNetworkState);

    return () => {
      connection?.removeEventListener?.('change', updateNetworkState);
    };
  }, [normalizedMaxSizeInBytes]);

  useEffect(() => {
    resourceFilterRef.current = resourceFilter;
    effectiveMaxSizeInBytesRef.current = effectiveMaxSizeInBytes;
    effectiveTypeRef.current = effectiveType;
    onWarningRef.current = onWarning;
  }, [effectiveMaxSizeInBytes, effectiveType, onWarning, resourceFilter]);

  const handleEntry = useCallback((entry: PerformanceResourceTiming, notify = true) => {
    if (!matchesResourceFilter(entry, resourceFilterRef.current)) return;

    const key = getResourceEntryKey(entry);
    const metric = toNetworkEfficiencyEntry(
      entry,
      effectiveMaxSizeInBytesRef.current,
      effectiveTypeRef.current,
    );

    setLatest((current) =>
      areSameNetworkEfficiencyEntry(current?.metric ?? null, metric)
        ? current
        : {
            source: entry,
            metric,
          },
    );

    retainResourceEntry(processedEntriesRef.current, entryInefficientStateRef.current, key, entry);

    const wasInefficient = entryInefficientStateRef.current.get(key) === true;
    entryInefficientStateRef.current.set(key, metric.isInefficient);

    if (notify && metric.isInefficient && !wasInefficient) {
      onWarningRef.current?.(metric);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !isSupported) return;

    for (const entry of performance.getEntriesByType('resource')) {
      if (isResourceTiming(entry)) {
        handleEntry(entry);
      }
    }

    if (!supportsResourceObserver()) return;

    const Observer = PerformanceObserver as PerformanceObserverConstructorLike;
    const observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        if (isResourceTiming(entry)) {
          handleEntry(entry);
        }
      }
    });

    observer.observe({
      type: 'resource',
      buffered: true,
    } as PerformanceObserverInit);

    return () => observer.disconnect();
  }, [enabled, handleEntry, isSupported, resourceFilterKey]);

  useEffect(() => {
    if (!enabled || !isSupported) return;

    for (const entry of processedEntriesRef.current.values()) {
      handleEntry(entry);
    }
  }, [
    effectiveMaxSizeInBytes,
    effectiveType,
    enabled,
    handleEntry,
    isSupported,
    resourceFilterKey,
  ]);

  const currentLatest = useMemo<NetworkEfficiencyEntry | null>(() => {
    if (!latest) return null;
    if (!matchesResourceFilter(latest.source, resourceFilter)) {
      return null;
    }

    return {
      ...latest.metric,
      effectiveMaxSizeInBytes,
      effectiveType,
      isInefficient: latest.metric.payloadSize > effectiveMaxSizeInBytes,
    };
  }, [effectiveMaxSizeInBytes, effectiveType, latest, resourceFilter]);

  if (!isSupported) {
    return {
      ...unsupportedState,
      effectiveMaxSizeInBytes,
      effectiveType,
    };
  }

  return {
    lastPayloadSize: currentLatest?.payloadSize ?? null,
    isInefficient: currentLatest?.isInefficient ?? false,
    latest: currentLatest,
    effectiveMaxSizeInBytes,
    effectiveType,
    isSupported,
  };
}
