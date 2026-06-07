import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongTasks } from './index';

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }, observer: PerformanceObserver) => void;

const originalPerformanceObserver = globalThis.PerformanceObserver;

class MockPerformanceObserver {
  static supportedEntryTypes = ['longtask'];
  static callback: ObserverCallback | null = null;
  static observe = vi.fn();
  static disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    MockPerformanceObserver.callback = callback;
  }

  observe(options: PerformanceObserverInit): void {
    MockPerformanceObserver.observe(options);
  }

  disconnect(): void {
    MockPerformanceObserver.disconnect();
  }
}

function setMockPerformanceObserver(entryTypes: string[] = ['longtask']): void {
  MockPerformanceObserver.supportedEntryTypes = entryTypes;
  globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;
}

function emitEntry(entry: Partial<PerformanceEntry> & { attribution?: unknown[] }): void {
  act(() => {
    MockPerformanceObserver.callback?.(
      {
        getEntries: () => [entry as PerformanceEntry],
      },
      {} as PerformanceObserver
    );
  });
}

describe('useLongTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockPerformanceObserver.callback = null;
    setMockPerformanceObserver();
  });

  afterEach(() => {
    globalThis.PerformanceObserver = originalPerformanceObserver;
  });

  it('returns empty values before the first long task', () => {
    const { result } = renderHook(() => useLongTasks());

    expect(result.current.latest).toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.totalBlockingTime).toBe(0);
    expect(result.current.isSupported).toBe(true);
  });

  it('observes longtask entries with buffered entries', () => {
    renderHook(() => useLongTasks());

    expect(MockPerformanceObserver.observe).toHaveBeenCalledWith({
      type: 'longtask',
      buffered: true,
    });
  });

  it('records a long task with blocking time and screen', () => {
    const onLongTask = vi.fn();
    const { result } = renderHook(() => useLongTasks({ screen: 'checkout', onLongTask }));

    emitEntry({
      name: 'self',
      duration: 120,
      startTime: 240,
      attribution: [
        {
          name: 'script',
          containerType: 'window',
          containerSrc: 'https://example.com/app.js',
          containerId: 'root',
          containerName: 'main',
        },
      ],
    });

    expect(result.current.latest).toMatchObject({
      name: 'longtask',
      duration: 120,
      blockingTime: 70,
      startTime: 240,
      screen: 'checkout',
      attribution: [
        {
          name: 'script',
          containerType: 'window',
          containerSrc: 'https://example.com/app.js',
          containerId: 'root',
          containerName: 'main',
        },
      ],
    });
    expect(result.current.count).toBe(1);
    expect(result.current.totalBlockingTime).toBe(70);
    expect(onLongTask).toHaveBeenCalledWith(expect.objectContaining({ duration: 120, screen: 'checkout' }));
  });

  it('resolves screen lazily from a function', () => {
    let screen = 'catalog';
    const { result } = renderHook(() => useLongTasks({ screen: () => screen }));

    screen = 'details';
    emitEntry({ name: 'self', duration: 80, startTime: 10 });

    expect(result.current.latest?.screen).toBe('details');
  });

  it('filters tasks below a custom minimum duration', () => {
    const onLongTask = vi.fn();
    const { result } = renderHook(() => useLongTasks({ minDuration: 100, onLongTask }));

    emitEntry({ name: 'self', duration: 70, startTime: 10 });
    emitEntry({ name: 'self', duration: 110, startTime: 20 });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.latest?.duration).toBe(110);
    expect(onLongTask).toHaveBeenCalledTimes(1);
  });

  it('keeps only the configured number of entries', () => {
    const { result } = renderHook(() => useLongTasks({ maxEntries: 2 }));

    emitEntry({ name: 'self', duration: 60, startTime: 1 });
    emitEntry({ name: 'self', duration: 70, startTime: 2 });
    emitEntry({ name: 'self', duration: 80, startTime: 3 });

    expect(result.current.entries.map((entry) => entry.startTime)).toEqual([2, 3]);
    expect(result.current.count).toBe(2);
    expect(result.current.totalBlockingTime).toBe(50);
  });

  it('allows disabling state retention while still reporting long tasks', () => {
    const onLongTask = vi.fn();
    const { result } = renderHook(() => useLongTasks({ maxEntries: 0, onLongTask }));

    emitEntry({ name: 'self', duration: 90, startTime: 1 });

    expect(result.current.latest).toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(onLongTask).toHaveBeenCalledWith(expect.objectContaining({ duration: 90 }));
  });

  it('falls back to default retention for non-finite maxEntries values', () => {
    const { result } = renderHook(() => useLongTasks({ maxEntries: Number.NaN }));

    emitEntry({ name: 'self', duration: 90, startTime: 1 });

    expect(result.current.entries).toHaveLength(1);
  });

  it('does not subscribe when enabled=false', () => {
    const { result } = renderHook(() => useLongTasks({ enabled: false }));

    expect(result.current.isSupported).toBe(true);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('returns unsupported state when Long Tasks are unavailable', () => {
    setMockPerformanceObserver(['event']);

    const { result } = renderHook(() => useLongTasks());

    expect(result.current.isSupported).toBe(false);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useLongTasks());

    unmount();

    expect(MockPerformanceObserver.disconnect).toHaveBeenCalledTimes(1);
  });
});
