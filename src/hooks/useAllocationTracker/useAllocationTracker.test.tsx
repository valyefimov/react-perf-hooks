import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __allocationTrackerInternals, useAllocationTracker } from './index';

describe('useAllocationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    __allocationTrackerInternals.records.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    __allocationTrackerInternals.records.clear();
  });

  it('registers target objects when enabled and supported', () => {
    const { result } = renderHook(() =>
      useAllocationTracker({ componentName: 'HeavyEditor', enabled: true }),
    );

    const target = new Uint8Array(1024);

    expect(result.current(target, 'buffer')).toBe(true);
    expect(__allocationTrackerInternals.records.size).toBe(1);

    const [record] = __allocationTrackerInternals.records.values();

    expect(record.componentName).toBe('HeavyEditor');
    expect(record.allocationName).toBe('buffer');
  });

  it('returns false and stores no records when disabled', () => {
    const { result, unmount } = renderHook(() =>
      useAllocationTracker({ componentName: 'HeavyEditor', enabled: false }),
    );

    expect(result.current({})).toBe(false);

    unmount();
    act(() => vi.runAllTimers());

    expect(__allocationTrackerInternals.records.size).toBe(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('reports a potential leak after unmount timeout', () => {
    const onLeakDetected = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAllocationTracker({
        componentName: 'HeavyEditor',
        enabled: true,
        timeoutMs: 250,
        onLeakDetected,
      }),
    );

    const target = { large: new Uint8Array(1024) };

    result.current(target, 'cache');
    unmount();

    act(() => vi.advanceTimersByTime(249));
    expect(onLeakDetected).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));

    expect(onLeakDetected).toHaveBeenCalledTimes(1);
    expect(onLeakDetected).toHaveBeenCalledWith(
      'HeavyEditor',
      expect.objectContaining({
        allocationName: 'cache',
        componentName: 'HeavyEditor',
        timeoutMs: 250,
      }),
    );
  });

  it('does not treat disabling tracking as an unmount', () => {
    const onLeakDetected = vi.fn();
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) =>
        useAllocationTracker({
          componentName: 'ToggleComponent',
          enabled,
          timeoutMs: 10,
          onLeakDetected,
        }),
      {
        initialProps: { enabled: true },
      },
    );

    result.current({ retained: true }, 'cache');

    rerender({ enabled: false });

    act(() => vi.advanceTimersByTime(10));

    expect(onLeakDetected).not.toHaveBeenCalled();

    const [record] = __allocationTrackerInternals.records.values();
    expect(record.unmountedAt).toBeUndefined();

    unmount();

    act(() => vi.advanceTimersByTime(10));

    expect(onLeakDetected).toHaveBeenCalledTimes(1);
    expect(onLeakDetected).toHaveBeenCalledWith(
      'ToggleComponent',
      expect.objectContaining({
        allocationName: 'cache',
        componentName: 'ToggleComponent',
        timeoutMs: 10,
      }),
    );
  });

  it('falls back to console.warn when no leak callback is provided', () => {
    const { result, unmount } = renderHook(() =>
      useAllocationTracker({
        componentName: 'FallbackComponent',
        enabled: true,
        timeoutMs: 10,
      }),
    );

    result.current({}, 'listener');
    unmount();

    act(() => vi.advanceTimersByTime(10));

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('FallbackComponent'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('listener'));
  });

  it('does not report records already marked collected before timeout', () => {
    const onLeakDetected = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAllocationTracker({
        componentName: 'CollectedComponent',
        enabled: true,
        timeoutMs: 10,
        onLeakDetected,
      }),
    );

    result.current({}, 'temporary');

    const [record] = __allocationTrackerInternals.records.values();
    record.collected = true;

    unmount();
    act(() => vi.advanceTimersByTime(10));

    expect(onLeakDetected).not.toHaveBeenCalled();
  });

  it('uses the default timeout for invalid timeout values', () => {
    const onLeakDetected = vi.fn();
    const { result, unmount } = renderHook(() =>
      useAllocationTracker({
        componentName: 'InvalidTimeout',
        enabled: true,
        timeoutMs: Number.NaN,
        onLeakDetected,
      }),
    );

    result.current({});
    unmount();

    act(() => vi.advanceTimersByTime(4999));
    expect(onLeakDetected).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onLeakDetected).toHaveBeenCalledTimes(1);
  });
});
