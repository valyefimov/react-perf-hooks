import { useEffect, useState } from 'react';

export interface ComponentLifecycleInfo {
  /** Timestamp (ms) captured at mount via performance.now() */
  mountedAt: number;
  /** Milliseconds elapsed since mount, recomputed on every render */
  aliveMs: number;
}

const getNow = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

/**
 * Tracks component lifecycle timings:
 * - mount timestamp
 * - live time since mount (updated on each render)
 * - unmount timestamp and total lifetime (dev logs)
 */
export function useComponentLifecycle(componentName?: string): ComponentLifecycleInfo {
  const [mountedAt] = useState<number>(() => getNow());
  const [label] = useState<string>(() =>
    componentName ? `[useComponentLifecycle:${componentName}]` : '[useComponentLifecycle]'
  );

  const aliveMs = Math.max(0, getNow() - mountedAt);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    console.log(`${label} mounted at ${mountedAt.toFixed(2)} ms`);

    return () => {
      const unmountedAt = getNow();
      const totalAliveMs = Math.max(0, unmountedAt - mountedAt);

      console.log(`${label} unmounted at ${unmountedAt.toFixed(2)} ms (alive ${totalAliveMs.toFixed(2)} ms)`);
    };
  }, [label, mountedAt]);

  return {
    mountedAt,
    aliveMs,
  };
}
