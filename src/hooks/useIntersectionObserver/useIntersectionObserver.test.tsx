import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntersectionObserver } from './index';

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  private readonly callback: IntersectionObserverCallback;

  readonly observe = vi.fn((_target: Element): void => undefined);
  readonly unobserve = vi.fn((_target: Element): void => undefined);
  readonly disconnect = vi.fn((): void => undefined);
  readonly takeRecords = vi.fn((): IntersectionObserverEntry[] => []);

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback;
    this.root = options.root ?? null;
    this.rootMargin = options.rootMargin ?? '';
    this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold ?? 0];
    MockIntersectionObserver.instances.push(this);
  }

  trigger(entry: Partial<IntersectionObserverEntry>): void {
    this.callback([entry as IntersectionObserverEntry], this);
  }

  static reset(): void {
    MockIntersectionObserver.instances = [];
  }
}

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    MockIntersectionObserver.reset();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a ref callback, hidden state, and empty metrics initially', () => {
    const { result } = renderHook(() => useIntersectionObserver());

    expect(typeof result.current.ref).toBe('function');
    expect(result.current.isVisible).toBe(false);
    expect(result.current.metrics).toEqual({
      firstVisibleAt: null,
      totalVisibleMs: 0,
    });
  });

  it('observes the target and records visibility metrics', () => {
    const { result } = renderHook(() => useIntersectionObserver());
    const target = document.createElement('div');

    act(() => {
      result.current.ref(target);
    });

    const observer = MockIntersectionObserver.instances[0]!;
    expect(observer.observe).toHaveBeenCalledWith(target);

    act(() => {
      observer.trigger({
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 120,
      });
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.metrics.firstVisibleAt).toBe(120);
    expect(result.current.metrics.totalVisibleMs).toBe(0);

    act(() => {
      observer.trigger({
        target,
        isIntersecting: false,
        intersectionRatio: 0,
        time: 420,
      });
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.metrics.totalVisibleMs).toBe(300);

    act(() => {
      observer.trigger({
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 600,
      });
      observer.trigger({
        target,
        isIntersecting: false,
        intersectionRatio: 0,
        time: 850,
      });
    });

    expect(result.current.metrics.firstVisibleAt).toBe(120);
    expect(result.current.metrics.totalVisibleMs).toBe(550);
  });

  it('respects threshold when determining visibility', () => {
    const { result } = renderHook(() => useIntersectionObserver({ threshold: 0.5 }));
    const target = document.createElement('div');

    act(() => {
      result.current.ref(target);
    });

    const observer = MockIntersectionObserver.instances[0]!;

    act(() => {
      observer.trigger({
        target,
        isIntersecting: true,
        intersectionRatio: 0.25,
        time: 80,
      });
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.metrics.firstVisibleAt).toBeNull();

    act(() => {
      observer.trigger({
        target,
        isIntersecting: true,
        intersectionRatio: 0.75,
        time: 100,
      });
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.metrics.firstVisibleAt).toBe(100);
  });

  it('commits ongoing visibility duration when the target is detached', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(260);
    const { result } = renderHook(() => useIntersectionObserver());
    const target = document.createElement('div');

    act(() => {
      result.current.ref(target);
    });

    const observer = MockIntersectionObserver.instances[0]!;

    act(() => {
      observer.trigger({
        target,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 100,
      });
    });

    act(() => {
      result.current.ref(null);
    });

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(nowSpy).toHaveBeenCalled();
    expect(result.current.isVisible).toBe(false);
    expect(result.current.metrics.totalVisibleMs).toBe(160);
  });

  it('does not create an observer when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = renderHook(() => useIntersectionObserver());
    const target = document.createElement('div');

    act(() => {
      result.current.ref(target);
    });

    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(result.current.isVisible).toBe(false);
    expect(result.current.metrics.firstVisibleAt).toBeNull();
  });

  it('is safe to render during SSR', () => {
    function TestComponent() {
      const { isVisible, metrics } = useIntersectionObserver();
      return (
        <div data-visible={String(isVisible)}>
          {metrics.firstVisibleAt ?? 'never'}:{metrics.totalVisibleMs}
        </div>
      );
    }

    expect(() => renderToString(<TestComponent />)).not.toThrow();
  });
});
