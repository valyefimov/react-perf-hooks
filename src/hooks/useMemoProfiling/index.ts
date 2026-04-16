import { type DependencyList, useMemo } from 'react';

export interface MemoProfilingStats {
  /** Label associated with the profiled memoized value */
  label: string;
  /** Number of renders that reused the cached value */
  hits: number;
  /** Number of renders that recomputed the value */
  misses: number;
  /** Total milliseconds spent recomputing across all misses */
  totalRecomputeMs: number;
  /** Average milliseconds per miss */
  averageRecomputeMs: number;
}

interface MutableMemoProfilingStats {
  hits: number;
  misses: number;
  totalRecomputeMs: number;
}

const DEFAULT_LABEL = 'default';
const statsStore = new Map<string, MutableMemoProfilingStats>();

const isProfilingEnabled = (): boolean => process.env.NODE_ENV !== 'production';

const getNow = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const normalizeLabel = (label?: string): string => {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_LABEL;
};

const toPublicStats = (label: string, mutableStats?: MutableMemoProfilingStats): MemoProfilingStats => {
  const hits = mutableStats?.hits ?? 0;
  const misses = mutableStats?.misses ?? 0;
  const totalRecomputeMs = mutableStats?.totalRecomputeMs ?? 0;

  return {
    label,
    hits,
    misses,
    totalRecomputeMs,
    averageRecomputeMs: misses > 0 ? totalRecomputeMs / misses : 0,
  };
};

const getOrCreateStats = (label: string): MutableMemoProfilingStats => {
  const existing = statsStore.get(label);
  if (existing) return existing;

  const created: MutableMemoProfilingStats = {
    hits: 0,
    misses: 0,
    totalRecomputeMs: 0,
  };

  statsStore.set(label, created);
  return created;
};

/**
 * Returns cache hit/miss stats for a specific memo label.
 * In production this always returns zeroed stats.
 */
export function getStats(label?: string): MemoProfilingStats {
  const resolvedLabel = normalizeLabel(label);

  if (!isProfilingEnabled()) {
    return toPublicStats(resolvedLabel);
  }

  return toPublicStats(resolvedLabel, statsStore.get(resolvedLabel));
}

/**
 * `useMemo` wrapper that reports cache HIT/MISS behavior in development.
 * In production it behaves like a plain `useMemo` with zero profiling overhead.
 */
export function useMemoProfiling<T>(factory: () => T, deps: DependencyList, label?: string): T {
  const resolvedLabel = normalizeLabel(label);
  const profilingEnabled = isProfilingEnabled();

  let cacheHit = true;
  let recomputeMs = 0;

  const value = useMemo(() => {
    if (!profilingEnabled) {
      return factory();
    }

    cacheHit = false;
    const start = getNow();
    const computed = factory();
    recomputeMs = Math.max(0, getNow() - start);
    return computed;
  }, deps);

  if (!profilingEnabled) {
    return value;
  }

  const stats = getOrCreateStats(resolvedLabel);

  if (cacheHit) {
    stats.hits += 1;
    console.log(`[useMemoProfiling:${resolvedLabel}] HIT`);
  } else {
    stats.misses += 1;
    stats.totalRecomputeMs += recomputeMs;
    console.log(`[useMemoProfiling:${resolvedLabel}] MISS (recomputed in ${recomputeMs.toFixed(2)}ms)`);
  }

  return value;
}
