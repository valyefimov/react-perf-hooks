import { useEffect, useState } from 'react';

export interface UseMemoryStatusOptions {
  /**
   * Ratio of used heap to total heap that marks the app as memory-risky.
   * Defaults to `0.8`.
   */
  warningThresholdRatio?: number;
  /**
   * Polling interval in milliseconds.
   * Defaults to `5000`.
   */
  interval?: number;
  /**
   * Set to `false` to disable polling.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseMemoryStatusReturn {
  /** Current used JavaScript heap size in bytes, or `null` when unsupported. */
  usedJSHeapSize: number | null;
  /** Current total allocated JavaScript heap size in bytes, or `null` when unsupported. */
  totalJSHeapSize: number | null;
  /** Browser JavaScript heap size limit in bytes, or `null` when unsupported. */
  jsHeapSizeLimit: number | null;
  /** Alias for `jsHeapSizeLimit`, matching common memory monitoring terminology. */
  memoryLimit: number | null;
  /** Whether `usedJSHeapSize / totalJSHeapSize` exceeds `warningThresholdRatio`. */
  isRiskZone: boolean;
  /** Whether this browser exposes Chromium's non-standard `performance.memory` API. */
  isSupported: boolean;
}

interface PerformanceMemoryLike {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemoryLike;
}

const DEFAULT_WARNING_THRESHOLD_RATIO = 0.8;
const DEFAULT_INTERVAL = 5000;

const unsupportedState: UseMemoryStatusReturn = {
  usedJSHeapSize: null,
  totalJSHeapSize: null,
  jsHeapSizeLimit: null,
  memoryLimit: null,
  isRiskZone: false,
  isSupported: false,
};

function normalizeWarningThresholdRatio(ratio: number): number {
  return Number.isFinite(ratio) && ratio >= 0 ? ratio : DEFAULT_WARNING_THRESHOLD_RATIO;
}

function normalizeInterval(interval: number): number {
  return Number.isFinite(interval) && interval > 0
    ? Math.max(1, Math.floor(interval))
    : DEFAULT_INTERVAL;
}

function getPerformanceMemory(): PerformanceMemoryLike | null {
  if (typeof window === 'undefined') return null;

  const memory = (window.performance as PerformanceWithMemory | undefined)?.memory;

  if (
    !memory ||
    !Number.isFinite(memory.usedJSHeapSize) ||
    !Number.isFinite(memory.totalJSHeapSize) ||
    !Number.isFinite(memory.jsHeapSizeLimit)
  ) {
    return null;
  }

  return memory;
}

function toMemoryStatus(
  memory: PerformanceMemoryLike,
  warningThresholdRatio: number,
): UseMemoryStatusReturn {
  const isRiskZone =
    memory.totalJSHeapSize > 0 &&
    memory.usedJSHeapSize / memory.totalJSHeapSize >= warningThresholdRatio;

  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
    memoryLimit: memory.jsHeapSizeLimit,
    isRiskZone,
    isSupported: true,
  };
}

/**
 * Polls Chromium's non-standard `performance.memory` API and exposes JavaScript
 * heap telemetry for dashboards, editors, and other memory-sensitive views.
 *
 * @example
 * function MemoryBadge() {
 *   const { usedJSHeapSize, totalJSHeapSize, isRiskZone, isSupported } = useMemoryStatus();
 *
 *   if (!isSupported) return null;
 *
 *   return <span>{isRiskZone ? 'High memory pressure' : `${usedJSHeapSize} / ${totalJSHeapSize}`}</span>;
 * }
 */
export function useMemoryStatus(options: UseMemoryStatusOptions = {}): UseMemoryStatusReturn {
  const {
    warningThresholdRatio = DEFAULT_WARNING_THRESHOLD_RATIO,
    interval = DEFAULT_INTERVAL,
    enabled = true,
  } = options;
  const normalizedWarningThresholdRatio = normalizeWarningThresholdRatio(warningThresholdRatio);
  const normalizedInterval = normalizeInterval(interval);
  const [state, setState] = useState<UseMemoryStatusReturn>(() => {
    const memory = getPerformanceMemory();
    return memory ? toMemoryStatus(memory, normalizedWarningThresholdRatio) : unsupportedState;
  });

  useEffect(() => {
    if (!enabled) return;

    const updateMemoryStatus = () => {
      const memory = getPerformanceMemory();
      const nextState = memory
        ? toMemoryStatus(memory, normalizedWarningThresholdRatio)
        : unsupportedState;

      setState((current) => {
        if (
          current.usedJSHeapSize === nextState.usedJSHeapSize &&
          current.totalJSHeapSize === nextState.totalJSHeapSize &&
          current.jsHeapSizeLimit === nextState.jsHeapSizeLimit &&
          current.isRiskZone === nextState.isRiskZone &&
          current.isSupported === nextState.isSupported
        ) {
          return current;
        }

        return nextState;
      });
    };

    updateMemoryStatus();

    if (!getPerformanceMemory()) return;

    const intervalId = window.setInterval(updateMemoryStatus, normalizedInterval);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, normalizedInterval, normalizedWarningThresholdRatio]);

  return state;
}
