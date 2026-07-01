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

const DEFAULT_MAX_SIZE_IN_BYTES = 1024 * 500;

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

function getEffectiveType(): NetworkEffectiveType | null {
  return getConnection()?.effectiveType ?? null;
}

function getEffectiveMaxSizeInBytes(maxSizeInBytes: number): number {
  const connection = getConnection();
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

function getPayloadSize(entry: PerformanceResourceTiming): number {
  const sizes = [entry.transferSize, entry.encodedBodySize, entry.decodedBodySize];
  const size = sizes.find((value) => Number.isFinite(value) && value > 0);
  return size ?? 0;
}

function getResourceEntryKey(entry: PerformanceResourceTiming): string {
  return `${entry.name}:${entry.startTime}:${entry.duration}:${entry.transferSize}:${entry.encodedBodySize}:${entry.decodedBodySize}`;
}

function toNetworkEfficiencyEntry(
  entry: PerformanceResourceTiming,
  effectiveMaxSizeInBytes: number,
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
    effectiveType: getEffectiveType(),
    isInefficient: payloadSize > effectiveMaxSizeInBytes,
    startTime: entry.startTime,
    duration: entry.duration,
    timestamp: getNow(),
  };
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
  const effectiveMaxSizeInBytes = useMemo(
    () => getEffectiveMaxSizeInBytes(normalizedMaxSizeInBytes),
    [normalizedMaxSizeInBytes],
  );
  const effectiveType = useMemo(() => getEffectiveType(), []);
  const isSupported = supportsResourceTiming();
  const [latest, setLatest] = useState<NetworkEfficiencyEntry | null>(null);
  const processedEntryKeysRef = useRef(new Set<string>());
  const resourceFilterRef = useRef(resourceFilter);
  const effectiveMaxSizeInBytesRef = useRef(effectiveMaxSizeInBytes);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    resourceFilterRef.current = resourceFilter;
    effectiveMaxSizeInBytesRef.current = effectiveMaxSizeInBytes;
    onWarningRef.current = onWarning;
  }, [effectiveMaxSizeInBytes, onWarning, resourceFilter]);

  const handleEntry = useCallback((entry: PerformanceResourceTiming) => {
    if (!matchesResourceFilter(entry, resourceFilterRef.current)) return;

    const key = getResourceEntryKey(entry);
    if (processedEntryKeysRef.current.has(key)) return;

    processedEntryKeysRef.current.add(key);
    const metric = toNetworkEfficiencyEntry(entry, effectiveMaxSizeInBytesRef.current);

    setLatest(metric);

    if (metric.isInefficient) {
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
  }, [enabled, handleEntry, isSupported]);

  if (!isSupported) {
    return {
      ...unsupportedState,
      effectiveMaxSizeInBytes,
      effectiveType,
    };
  }

  return {
    lastPayloadSize: latest?.payloadSize ?? null,
    isInefficient: latest?.isInefficient ?? false,
    latest,
    effectiveMaxSizeInBytes,
    effectiveType,
    isSupported,
  };
}
