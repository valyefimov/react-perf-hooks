import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedState } from './index';

describe('useDebouncedState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns initial state and empty stats', () => {
    const { result } = renderHook(() => useDebouncedState('hello'));

    const [value, , stats] = result.current;

    expect(value).toBe('hello');
    expect(stats.skippedRenders).toBe(0);
    expect(stats.totalUpdates).toBe(0);
  });

  it('debounces state updates until delay elapses', () => {
    const { result } = renderHook(() => useDebouncedState(0, 200));

    act(() => {
      result.current[1](1);
    });

    expect(result.current[0]).toBe(0);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(result.current[0]).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current[0]).toBe(1);
  });

  it('increments totalUpdates on each setter call', () => {
    const { result } = renderHook(() => useDebouncedState('start', 100));

    act(() => {
      result.current[1]('a');
      result.current[1]('b');
      result.current[1]('c');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[2].totalUpdates).toBe(3);
  });

  it('increments skippedRenders when pending debounced updates are replaced', () => {
    const { result } = renderHook(() => useDebouncedState('', 100));

    act(() => {
      result.current[1]('a');
      result.current[1]('ab');
      result.current[1]('abc');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[2].skippedRenders).toBe(2);
    expect(result.current[0]).toBe('abc');
  });

  it('supports functional updates against queued debounced value', () => {
    const { result } = renderHook(() => useDebouncedState(0, 100));

    act(() => {
      result.current[1]((prev) => prev + 1);
      result.current[1]((prev) => prev + 1);
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current[0]).toBe(2);
    expect(result.current[2].skippedRenders).toBe(1);
  });

  it('updates immediately when delay is zero', () => {
    const { result } = renderHook(() => useDebouncedState(1, 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(2);
    expect(result.current[2].skippedRenders).toBe(0);
    expect(result.current[2].totalUpdates).toBe(1);
  });

  it('cancels pending timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useDebouncedState('initial', 100));

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
