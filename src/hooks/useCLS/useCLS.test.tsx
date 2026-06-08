import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCLS } from './index';

type ObserverCallback = (
  list: { getEntries: () => PerformanceEntry[] },
  observer: PerformanceObserver,
) => void;

const originalPerformanceObserver = globalThis.PerformanceObserver;

class MockPerformanceObserver {
  static supportedEntryTypes = ['layout-shift'];
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

function setMockPerformanceObserver(entryTypes: string[] = ['layout-shift']): void {
  MockPerformanceObserver.supportedEntryTypes = entryTypes;
  globalThis.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver;
}

function attachRef<T extends Element>(ref: (node: T | null) => void, node: T): void {
  act(() => {
    ref(node);
  });
}

function emitEntry(
  entry: Partial<PerformanceEntry> & {
    value?: number;
    hadRecentInput?: boolean;
    sources?: unknown[];
  },
): void {
  act(() => {
    MockPerformanceObserver.callback?.(
      {
        getEntries: () => [entry as PerformanceEntry],
      },
      {} as PerformanceObserver,
    );
  });
}

describe('useCLS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockPerformanceObserver.callback = null;
    setMockPerformanceObserver();
  });

  afterEach(() => {
    globalThis.PerformanceObserver = originalPerformanceObserver;
  });

  it('returns initial component CLS state before the ref is attached', () => {
    const { result } = renderHook(() => useCLS());

    expect(result.current.metric).toBeNull();
    expect(result.current.value).toBe(0);
    expect(result.current.rating).toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(result.current.isSupported).toBe(true);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('observes buffered layout-shift entries after the ref is attached', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>());

    attachRef(result.current.ref, target);

    expect(MockPerformanceObserver.observe).toHaveBeenCalledWith({
      type: 'layout-shift',
      buffered: true,
    });
  });

  it('accumulates CLS inside one session window for the observed element', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>());
    attachRef(result.current.ref, target);

    emitEntry({
      name: 'layout-shift',
      value: 0.04,
      startTime: 120,
      hadRecentInput: false,
      sources: [{ node: target }],
    });
    emitEntry({
      name: 'layout-shift',
      value: 0.06,
      startTime: 180,
      hadRecentInput: false,
      sources: [{ node: target }],
    });

    expect(result.current.metric).toMatchObject({
      name: 'CLS',
      value: 0.1,
      delta: 0.06,
      rating: 'needs-improvement',
      startTime: 180,
      hadRecentInput: false,
    });
    expect(result.current.value).toBe(0.1);
    expect(result.current.entries).toHaveLength(2);
  });

  it('reports the largest CLS session window instead of a lifetime sum', () => {
    const target = document.createElement('div');
    const onMetric = vi.fn();
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ onMetric }));
    attachRef(result.current.ref, target);

    emitEntry({
      name: 'layout-shift',
      value: 0.08,
      startTime: 100,
      hadRecentInput: false,
      sources: [{ node: target }],
    });
    emitEntry({
      name: 'layout-shift',
      value: 0.07,
      startTime: 2200,
      hadRecentInput: false,
      sources: [{ node: target }],
    });
    emitEntry({
      name: 'layout-shift',
      value: 0.06,
      startTime: 2600,
      hadRecentInput: false,
      sources: [{ node: target }],
    });

    expect(result.current.metric).toMatchObject({
      value: 0.13,
      delta: 0.06,
      rating: 'needs-improvement',
      startTime: 2600,
    });
    expect(result.current.value).toBe(0.13);
    expect(result.current.entries.map((entry) => entry.value)).toEqual([0.08, 0.08, 0.13]);
    expect(onMetric).toHaveBeenCalledTimes(2);
    expect(onMetric).toHaveBeenLastCalledWith(expect.objectContaining({ value: 0.13 }));
  });

  it('starts a new CLS session after a five second window', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>());
    attachRef(result.current.ref, target);

    emitEntry({ value: 0.04, startTime: 100, hadRecentInput: false, sources: [{ node: target }] });
    emitEntry({ value: 0.05, startTime: 900, hadRecentInput: false, sources: [{ node: target }] });
    emitEntry({ value: 0.06, startTime: 5200, hadRecentInput: false, sources: [{ node: target }] });

    expect(result.current.value).toBe(0.09);
    expect(result.current.metric).toMatchObject({
      value: 0.09,
      delta: 0.06,
      rating: 'good',
      startTime: 5200,
    });
  });

  it('tracks layout shifts attributed to descendants by default', () => {
    const target = document.createElement('section');
    const child = document.createElement('img');
    target.appendChild(child);
    const { result } = renderHook(() => useCLS<HTMLElement>());
    attachRef(result.current.ref, target);

    emitEntry({
      value: 0.08,
      startTime: 20,
      hadRecentInput: false,
      sources: [{ node: child }],
    });

    expect(result.current.value).toBe(0.08);
    expect(result.current.metric?.sources[0]?.node).toBe(child);
  });

  it('can ignore descendant shifts when includeDescendants=false', () => {
    const target = document.createElement('section');
    const child = document.createElement('img');
    target.appendChild(child);
    const { result } = renderHook(() => useCLS<HTMLElement>({ includeDescendants: false }));
    attachRef(result.current.ref, target);

    emitEntry({
      value: 0.08,
      startTime: 20,
      hadRecentInput: false,
      sources: [{ node: child }],
    });
    emitEntry({
      value: 0.05,
      startTime: 30,
      hadRecentInput: false,
      sources: [{ node: target }],
    });

    expect(result.current.value).toBe(0.05);
    expect(result.current.entries).toHaveLength(1);
  });

  it('does not resubscribe or recount buffered entries when options change', () => {
    const target = document.createElement('div');
    const onMetric = vi.fn();
    const entry = {
      value: 0.08,
      startTime: 20,
      hadRecentInput: false,
      sources: [{ node: target }],
    };
    const { result, rerender } = renderHook(
      ({ maxEntries, includeDescendants }) =>
        useCLS<HTMLDivElement>({
          maxEntries,
          includeDescendants,
          onMetric,
        }),
      {
        initialProps: {
          maxEntries: 50,
          includeDescendants: true,
        },
      },
    );
    attachRef(result.current.ref, target);

    emitEntry(entry);
    rerender({ maxEntries: 2, includeDescendants: false });
    emitEntry(entry);

    expect(MockPerformanceObserver.observe).toHaveBeenCalledTimes(1);
    expect(result.current.value).toBe(0.08);
    expect(result.current.entries).toHaveLength(1);
    expect(onMetric).toHaveBeenCalledTimes(1);
  });

  it('ignores layout shifts caused by recent input by default', () => {
    const target = document.createElement('div');
    const onMetric = vi.fn();
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ onMetric }));
    attachRef(result.current.ref, target);

    emitEntry({
      value: 0.2,
      startTime: 10,
      hadRecentInput: true,
      sources: [{ node: target }],
    });

    expect(result.current.metric).toBeNull();
    expect(onMetric).not.toHaveBeenCalled();
  });

  it('can include layout shifts caused by recent input', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ ignoreRecentInput: false }));
    attachRef(result.current.ref, target);

    emitEntry({
      value: 0.2,
      startTime: 10,
      hadRecentInput: true,
      sources: [{ node: target }],
    });

    expect(result.current.metric).toMatchObject({
      value: 0.2,
      rating: 'needs-improvement',
      hadRecentInput: true,
    });
  });

  it('calls onMetric when the largest component CLS session value changes', () => {
    const target = document.createElement('div');
    const onMetric = vi.fn();
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ onMetric }));
    attachRef(result.current.ref, target);

    emitEntry({ value: 0.12, startTime: 1, hadRecentInput: false, sources: [{ node: target }] });
    emitEntry({ value: 0.14, startTime: 2, hadRecentInput: false, sources: [{ node: target }] });

    emitEntry({ value: 0.1, startTime: 3000, hadRecentInput: false, sources: [{ node: target }] });

    expect(onMetric).toHaveBeenCalledTimes(2);
    expect(onMetric).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: 0.26, rating: 'poor' }),
    );
  });

  it('limits retained entries with maxEntries', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ maxEntries: 2 }));
    attachRef(result.current.ref, target);

    emitEntry({ value: 0.01, startTime: 1, hadRecentInput: false, sources: [{ node: target }] });
    emitEntry({ value: 0.02, startTime: 2, hadRecentInput: false, sources: [{ node: target }] });
    emitEntry({ value: 0.03, startTime: 3, hadRecentInput: false, sources: [{ node: target }] });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.map((entry) => entry.delta)).toEqual([0.02, 0.03]);
  });

  it('resets metrics when the observed node changes', () => {
    const firstTarget = document.createElement('div');
    const secondTarget = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>());
    attachRef(result.current.ref, firstTarget);

    emitEntry({
      value: 0.12,
      startTime: 1,
      hadRecentInput: false,
      sources: [{ node: firstTarget }],
    });

    expect(result.current.value).toBe(0.12);

    attachRef(result.current.ref, secondTarget);

    expect(result.current.metric).toBeNull();
    expect(result.current.value).toBe(0);
    expect(result.current.entries).toEqual([]);

    emitEntry({
      value: 0.04,
      startTime: 2,
      hadRecentInput: false,
      sources: [{ node: secondTarget }],
    });

    expect(result.current.value).toBe(0.04);
  });

  it('does not subscribe when enabled=false', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>({ enabled: false }));
    attachRef(result.current.ref, target);

    expect(result.current.isSupported).toBe(true);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('returns unsupported state when layout-shift entries are unavailable', () => {
    setMockPerformanceObserver(['paint']);
    const target = document.createElement('div');
    const { result } = renderHook(() => useCLS<HTMLDivElement>());
    attachRef(result.current.ref, target);

    expect(result.current.isSupported).toBe(false);
    expect(MockPerformanceObserver.observe).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    const target = document.createElement('div');
    const { result, unmount } = renderHook(() => useCLS<HTMLDivElement>());
    attachRef(result.current.ref, target);

    unmount();

    expect(MockPerformanceObserver.disconnect).toHaveBeenCalledTimes(1);
  });
});
