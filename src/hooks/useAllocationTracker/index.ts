import { useCallback, useEffect, useRef } from 'react';

export interface AllocationLeakInfo {
  /** Stable id assigned to this tracked allocation. */
  id: number;
  /** Component label supplied to the hook. */
  componentName: string;
  /** Optional label supplied when the allocation was registered. */
  allocationName?: string;
  /** Timestamp captured with performance.now() when tracking started. */
  trackedAt: number;
  /** Timestamp captured when the owner component unmounted. */
  unmountedAt: number;
  /** Number of milliseconds waited after unmount before reporting. */
  timeoutMs: number;
}

export interface UseAllocationTrackerOptions {
  /** Display name used in warnings and callbacks. */
  componentName: string;
  /**
   * Enable tracking. Defaults to true in development, false in production.
   * Pass `true` only for diagnostic builds where FinalizationRegistry is available.
   */
  enabled?: boolean;
  /**
   * Time to wait after unmount before treating a still-reachable allocation as suspicious.
   * Defaults to 5000ms.
   */
  timeoutMs?: number;
  /**
   * Called when an allocation is still reachable after the unmount timeout.
   * This is a heuristic signal, not proof of a leak.
   */
  onLeakDetected?: (componentName: string, info: AllocationLeakInfo) => void;
}

export type TrackAllocation = (target: object, allocationName?: string) => boolean;

type RegistryHeldValue = {
  id: number;
};

type AllocationRecord = {
  id: number;
  componentName: string;
  allocationName?: string;
  trackedAt: number;
  timeoutMs: number;
  onLeakDetected?: (componentName: string, info: AllocationLeakInfo) => void;
  weakRef?: WeakRef<object>;
  collected: boolean;
  unmountedAt?: number;
  timerId?: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 5000;

let nextAllocationId = 1;
const records = new Map<number, AllocationRecord>();

const getNow = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const hasAllocationTrackingSupport = (): boolean =>
  typeof FinalizationRegistry !== 'undefined' && typeof WeakRef !== 'undefined';

let registry: FinalizationRegistry<RegistryHeldValue> | undefined;

const getRegistry = (): FinalizationRegistry<RegistryHeldValue> | undefined => {
  if (!hasAllocationTrackingSupport()) return undefined;

  registry ??= new FinalizationRegistry<RegistryHeldValue>(({ id }) => {
    const record = records.get(id);

    if (!record) return;

    record.collected = true;

    if (record.timerId) {
      clearTimeout(record.timerId);
    }

    records.delete(id);
  });

  return registry;
};

const normalizeTimeout = (timeoutMs: number | undefined): number => {
  if (timeoutMs == null) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) return DEFAULT_TIMEOUT_MS;

  return timeoutMs;
};

const scheduleLeakCheck = (record: AllocationRecord, unmountedAt: number): void => {
  record.unmountedAt = unmountedAt;

  record.timerId = setTimeout(() => {
    const latestRecord = records.get(record.id);

    if (!latestRecord || latestRecord.collected) return;

    if (latestRecord.weakRef && latestRecord.weakRef.deref() === undefined) {
      records.delete(latestRecord.id);
      return;
    }

    const info: AllocationLeakInfo = {
      id: latestRecord.id,
      componentName: latestRecord.componentName,
      allocationName: latestRecord.allocationName,
      trackedAt: latestRecord.trackedAt,
      unmountedAt,
      timeoutMs: latestRecord.timeoutMs,
    };

    if (latestRecord.onLeakDetected) {
      latestRecord.onLeakDetected(latestRecord.componentName, info);
    } else {
      console.warn(
        `[useAllocationTracker] Potential memory leak detected in "${latestRecord.componentName}". ` +
          `Allocation${latestRecord.allocationName ? ` "${latestRecord.allocationName}"` : ''} ` +
          `was still reachable ${latestRecord.timeoutMs}ms after unmount.`,
      );
    }
  }, record.timeoutMs);
};

/**
 * Tracks whether registered objects become eligible for garbage collection after unmount.
 *
 * This hook uses FinalizationRegistry and WeakRef in development to flag allocations that
 * remain reachable after their owner component unmounts. The signal is heuristic because
 * JavaScript garbage collection and finalizer delivery are intentionally nondeterministic.
 */
export function useAllocationTracker(options: UseAllocationTrackerOptions): TrackAllocation {
  const {
    componentName,
    enabled = process.env.NODE_ENV !== 'production',
    timeoutMs,
    onLeakDetected,
  } = options;

  const allocationIdsRef = useRef<number[]>([]);

  const normalizedTimeoutMs = normalizeTimeout(timeoutMs);
  const canTrack = enabled && hasAllocationTrackingSupport();

  useEffect(() => {
    return () => {
      const unmountedAt = getNow();
      // This ref is a mutable allocation registry, not a rendered node; cleanup needs latest IDs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const allocationIds = allocationIdsRef.current;

      for (const id of allocationIds) {
        const record = records.get(id);

        if (!record || record.collected || record.unmountedAt != null) continue;

        scheduleLeakCheck(record, unmountedAt);
      }
    };
  }, []);

  return useCallback<TrackAllocation>(
    (target, allocationName) => {
      if (!canTrack) return false;

      const allocationRegistry = getRegistry();

      if (!allocationRegistry) return false;

      const id = nextAllocationId++;
      const record: AllocationRecord = {
        id,
        componentName,
        allocationName,
        trackedAt: getNow(),
        timeoutMs: normalizedTimeoutMs,
        onLeakDetected,
        weakRef: new WeakRef(target),
        collected: false,
      };

      records.set(id, record);
      allocationIdsRef.current.push(id);
      allocationRegistry.register(target, { id });

      return true;
    },
    [canTrack, componentName, normalizedTimeoutMs, onLeakDetected],
  );
}

export const __allocationTrackerInternals = {
  records,
  hasAllocationTrackingSupport,
};
