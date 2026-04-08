import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThrottledState } from './index';

describe('useThrottledState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns initial state and empty stats', () => {
    const { result } = renderHook(() => useThrottledState('hello'));

    const [value, , stats] = result.current;

    expect(value).toBe('hello');
    expect(stats.droppedUpdates).toBe(0);
    expect(stats.totalUpdates).toBe(0);
  });

  it('commits on the leading edge and flushes the latest trailing value by default', () => {
    const { result } = renderHook(() => useThrottledState(0, 100));

    act(() => {
      result.current[1](1);
      result.current[1](2);
      result.current[1](3);
    });

    expect(result.current[0]).toBe(1);
    expect(result.current[2].totalUpdates).toBe(1);
    expect(result.current[2].droppedUpdates).toBe(0);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(3);
    expect(result.current[2].totalUpdates).toBe(3);
    expect(result.current[2].droppedUpdates).toBe(1);
  });

  it('drops in-window updates when trailing is disabled', () => {
    const { result } = renderHook(() => useThrottledState(0, 100, { trailing: false }));

    act(() => {
      result.current[1](1);
      result.current[1](2);
      result.current[1](3);
    });

    expect(result.current[0]).toBe(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(1);
    expect(result.current[2].totalUpdates).toBe(3);
    expect(result.current[2].droppedUpdates).toBe(2);
  });

  it('queues only the latest trailing value when leading is disabled', () => {
    const { result } = renderHook(() => useThrottledState(0, 100, { leading: false }));

    act(() => {
      result.current[1](1);
      result.current[1](2);
      result.current[1](3);
    });

    expect(result.current[0]).toBe(0);
    expect(result.current[2].totalUpdates).toBe(0);
    expect(result.current[2].droppedUpdates).toBe(0);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(3);
    expect(result.current[2].totalUpdates).toBe(3);
    expect(result.current[2].droppedUpdates).toBe(2);
  });

  it('supports functional updates against the latest queued value', () => {
    const { result } = renderHook(() => useThrottledState(0, 100, { leading: false }));

    act(() => {
      result.current[1]((prev) => prev + 1);
      result.current[1]((prev) => prev + 1);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(2);
    expect(result.current[2].totalUpdates).toBe(2);
    expect(result.current[2].droppedUpdates).toBe(1);
  });

  it('updates immediately when the interval is zero', () => {
    const { result } = renderHook(() => useThrottledState(1, 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(result.current[2].droppedUpdates).toBe(0);
    expect(result.current[2].totalUpdates).toBe(1);
  });

  it('throws when both leading and trailing are disabled', () => {
    expect(() => renderHook(() => useThrottledState(0, 100, { leading: false, trailing: false }))).toThrow(
      '[useThrottledState] At least one of `leading` or `trailing` must be true.'
    );
  });

  it('clears pending timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useThrottledState('initial', 100, { leading: false }));

    act(() => {
      result.current[1]('next');
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.runOnlyPendingTimers();
    });
  });
});
