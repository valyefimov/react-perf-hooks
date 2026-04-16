import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStats, useMemoProfiling } from './index';

describe('useMemoProfiling', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let labelCounter = 0;

  const nextLabel = (): string => {
    const label = `useMemoProfiling-test-${labelCounter}`;
    labelCounter += 1;
    return label;
  };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('returns memoized value and recomputes only when deps change', () => {
    const label = nextLabel();
    let multiplier = 2;
    const factory = vi.fn(() => multiplier * 10);

    const { result, rerender } = renderHook(() => useMemoProfiling(factory, [multiplier], label));

    expect(result.current).toBe(20);
    expect(factory).toHaveBeenCalledTimes(1);

    rerender();
    expect(result.current).toBe(20);
    expect(factory).toHaveBeenCalledTimes(1);

    multiplier = 3;
    rerender();
    expect(result.current).toBe(30);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('logs MISS with recomputation time and HIT when cached value is reused', () => {
    const label = nextLabel();
    let dep = 1;

    const { rerender } = renderHook(() => useMemoProfiling(() => dep * 2, [dep], label));

    rerender(); // unchanged dep -> HIT
    dep = 2;
    rerender(); // changed dep -> MISS

    const calls = vi.mocked(console.log).mock.calls.map((entry) => entry[0]);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatch(new RegExp(`^\\[useMemoProfiling:${label}\\] MISS \\(recomputed in \\d+\\.\\d{2}ms\\)$`));
    expect(calls[1]).toBe(`[useMemoProfiling:${label}] HIT`);
    expect(calls[2]).toMatch(new RegExp(`^\\[useMemoProfiling:${label}\\] MISS \\(recomputed in \\d+\\.\\d{2}ms\\)$`));
  });

  it('exposes accumulated stats via getStats(label)', () => {
    const label = nextLabel();
    let dep = 'a';

    const { rerender } = renderHook(() => useMemoProfiling(() => dep.toUpperCase(), [dep], label));

    rerender(); // HIT
    dep = 'b';
    rerender(); // MISS
    rerender(); // HIT

    const stats = getStats(label);

    expect(stats.label).toBe(label);
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.totalRecomputeMs).toBeGreaterThanOrEqual(0);
    expect(stats.averageRecomputeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns zeroed stats for an unseen label', () => {
    const label = nextLabel();
    const stats = getStats(label);

    expect(stats.label).toBe(label);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.totalRecomputeMs).toBe(0);
    expect(stats.averageRecomputeMs).toBe(0);
  });

  it('is a no-op in production (no logs, no profiling stats)', () => {
    process.env.NODE_ENV = 'production';

    const label = nextLabel();
    let dep = 5;
    const factory = vi.fn(() => dep + 1);

    const { result, rerender } = renderHook(() => useMemoProfiling(factory, [dep], label));
    expect(result.current).toBe(6);

    rerender(); // unchanged dep -> cached value
    dep = 6;
    rerender(); // changed dep -> recompute
    expect(result.current).toBe(7);

    expect(factory).toHaveBeenCalledTimes(2);
    expect(console.log).not.toHaveBeenCalled();

    const stats = getStats(label);
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.totalRecomputeMs).toBe(0);
    expect(stats.averageRecomputeMs).toBe(0);
  });
});
