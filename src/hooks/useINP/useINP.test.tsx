import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useINP } from './index';

type ObserverCallback = (list: { getEntries: () => PerformanceEntry[] }, observer: PerformanceObserver) => void;

const originalPerformanceObserver = globalThis.PerformanceObserver;

class MockPerformanceObserver {
  static supportedEntryTypes = ['event'];
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

function setMockPerformanceObserver(entryTypes: string[] = ['event']): void {
  MockPerformanceObserver.supportedEntryTypes = entryTypes;
  globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;
}

function emitEntry(entry: Partial<PerformanceEntry> & { interactionId?: number }): void {
  act(() => {
    MockPerformanceObserver.callback?.(
      {
        getEntries: () => [entry as PerformanceEntry],
      },
      {} as PerformanceObserver
    );
  });
}

describe('useINP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockPerformanceObserver.callback = null;
    setMockPerformanceObserver();
  });

  afterEach(() => {
    globalThis.PerformanceObserver = originalPerformanceObserver;
  });

  it('returns null values before the first interaction', () => {
    const { result } = renderHook(() => useINP());

    expect(result.current.metric).toBeNull();
    expect(result.current.value).toBeNull();
    expect(result.current.rating).toBeNull();
    expect(result.current.isSupported).toBe(true);
  });

  it('observes Event Timing entries with buffered events and a default duration threshold', () => {
    renderHook(() => useINP());

    expect(MockPerformanceObserver.observe).toHaveBeenCalledWith({
      type: 'event',
      buffered: true,
      durationThreshold: 40,
    });
  });

  it('uses a custom duration threshold', () => {
    renderHook(() => useINP({ durationThreshold: 16 }));

    expect(MockPerformanceObserver.observe).toHaveBeenCalledWith(
      expect.objectContaining({
        durationThreshold: 16,
      })
    );
  });

  it('updates with the first qualifying interaction', () => {
    const { result } = renderHook(() => useINP());

    emitEntry({
      name: 'click',
      duration: 180,
      startTime: 120,
      interactionId: 42,
    });

    expect(result.current.metric).toMatchObject({
      name: 'INP',
      value: 180,
      rating: 'good',
      eventType: 'click',
      startTime: 120,
      interactionId: 42,
    });
    expect(result.current.value).toBe(180);
    expect(result.current.rating).toBe('good');
  });

  it('keeps the worst interaction instead of replacing it with a faster one', () => {
    const { result } = renderHook(() => useINP());

    emitEntry({ name: 'keydown', duration: 260, startTime: 10, interactionId: 1 });
    emitEntry({ name: 'click', duration: 90, startTime: 20, interactionId: 2 });

    expect(result.current.metric).toMatchObject({
      value: 260,
      rating: 'needs-improvement',
      eventType: 'keydown',
      interactionId: 1,
    });
  });

  it('updates when a later interaction is worse', () => {
    const { result } = renderHook(() => useINP());

    emitEntry({ name: 'click', duration: 250, startTime: 10, interactionId: 1 });
    emitEntry({ name: 'pointerdown', duration: 520, startTime: 20, interactionId: 2 });

    expect(result.current.metric).toMatchObject({
      value: 520,
      rating: 'poor',
      eventType: 'pointerdown',
      interactionId: 2,
    });
  });

  it('calls onMetric only when the worst interaction changes', () => {
    const onMetric = vi.fn();
    renderHook(() => useINP({ onMetric }));

    emitEntry({ name: 'click', duration: 220, startTime: 10, interactionId: 1 });
    emitEntry({ name: 'keydown', duration: 200, startTime: 20, interactionId: 2 });
    emitEntry({ name: 'click', duration: 350, startTime: 30, interactionId: 3 });

    expect(onMetric).toHaveBeenCalledTimes(2);
    expect(onMetric).toHaveBeenLastCalledWith(expect.objectContaining({ value: 350 }));
  });

  it('ignores entries without a positive interaction id', () => {
    const onMetric = vi.fn();
    const { result } = renderHook(() => useINP({ onMetric }));

    emitEntry({ name: 'click', duration: 120, startTime: 10, interactionId: 0 });
    emitEntry({ name: 'pointerover', duration: 400, startTime: 20 });

    expect(result.current.metric).toBeNull();
    expect(onMetric).not.toHaveBeenCalled();
  });

  it('does not subscribe when enabled=false', () => {
    const { result } = renderHook(() => useINP({ enabled: false }));

    expect(result.current.isSupported).toBe(true);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('returns unsupported state when Event Timing is unavailable', () => {
    setMockPerformanceObserver(['paint']);

    const { result } = renderHook(() => useINP());

    expect(result.current.isSupported).toBe(false);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const { unmount } = renderHook(() => useINP());

    unmount();

    expect(MockPerformanceObserver.disconnect).toHaveBeenCalledTimes(1);
  });
});
