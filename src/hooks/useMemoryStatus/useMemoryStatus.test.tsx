import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemoryStatus } from './index';

interface MutablePerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

const originalMemoryDescriptor = Object.getOwnPropertyDescriptor(performance, 'memory');
let memory: MutablePerformanceMemory;

function installPerformanceMemory(nextMemory: MutablePerformanceMemory): void {
  memory = nextMemory;

  Object.defineProperty(performance, 'memory', {
    configurable: true,
    get: () => memory,
  });
}

function uninstallPerformanceMemory(): void {
  if (originalMemoryDescriptor) {
    Object.defineProperty(performance, 'memory', originalMemoryDescriptor);
    return;
  }

  delete (performance as Performance & { memory?: MutablePerformanceMemory }).memory;
}

describe('useMemoryStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installPerformanceMemory({
      usedJSHeapSize: 40,
      totalJSHeapSize: 100,
      jsHeapSizeLimit: 1000,
    });
  });

  afterEach(() => {
    uninstallPerformanceMemory();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the current heap telemetry when performance.memory is supported', () => {
    const { result } = renderHook(() => useMemoryStatus());

    expect(result.current).toEqual({
      usedJSHeapSize: 40,
      totalJSHeapSize: 100,
      jsHeapSizeLimit: 1000,
      memoryLimit: 1000,
      isRiskZone: false,
      isSupported: true,
    });
  });

  it('returns unsupported state without throwing when performance.memory is unavailable', () => {
    uninstallPerformanceMemory();

    const { result } = renderHook(() => useMemoryStatus());

    expect(result.current).toEqual({
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null,
      memoryLimit: null,
      isRiskZone: false,
      isSupported: false,
    });
  });

  it('polls memory on the configured interval', () => {
    const { result } = renderHook(() => useMemoryStatus({ interval: 1000 }));

    expect(result.current.usedJSHeapSize).toBe(40);

    memory = {
      usedJSHeapSize: 60,
      totalJSHeapSize: 100,
      jsHeapSizeLimit: 1000,
    };

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(result.current.usedJSHeapSize).toBe(40);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.usedJSHeapSize).toBe(60);
  });

  it('flags risk zone when used heap reaches the configured ratio of total heap', () => {
    const { result } = renderHook(() =>
      useMemoryStatus({ warningThresholdRatio: 0.75, interval: 1000 }),
    );

    expect(result.current.isRiskZone).toBe(false);

    memory = {
      usedJSHeapSize: 75,
      totalJSHeapSize: 100,
      jsHeapSizeLimit: 1000,
    };

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isRiskZone).toBe(true);
  });

  it('does not divide by zero when total heap is zero', () => {
    installPerformanceMemory({
      usedJSHeapSize: 1,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 1000,
    });

    const { result } = renderHook(() => useMemoryStatus({ warningThresholdRatio: 0 }));

    expect(result.current.isRiskZone).toBe(false);
  });

  it('does not start polling when disabled', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    renderHook(() => useMemoryStatus({ enabled: false }));

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('clears the polling interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => useMemoryStatus({ interval: 1000 }));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
