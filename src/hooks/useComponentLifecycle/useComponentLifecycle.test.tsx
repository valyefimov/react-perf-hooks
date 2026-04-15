import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useComponentLifecycle } from './index';

describe('useComponentLifecycle', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('captures mountedAt from performance.now() on mount', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(123.45);

    const { result, unmount } = renderHook(() => useComponentLifecycle());

    expect(result.current.mountedAt).toBe(123.45);
    expect(result.current.aliveMs).toBe(0);
    expect(nowSpy).toHaveBeenCalled();

    unmount();
  });

  it('updates aliveMs on each re-render using time since mount', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(10);

    const { result, rerender, unmount } = renderHook(() => useComponentLifecycle());

    expect(result.current.mountedAt).toBe(10);
    expect(result.current.aliveMs).toBe(0);

    nowSpy.mockReturnValue(25);
    rerender();
    expect(result.current.aliveMs).toBe(15);

    nowSpy.mockReturnValue(42);
    rerender();
    expect(result.current.aliveMs).toBe(32);

    unmount();
  });

  it('logs mount and unmount events with timestamps in dev mode', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(100);

    const { unmount } = renderHook(() => useComponentLifecycle());

    nowSpy.mockReturnValue(250);
    unmount();

    expect(console.log).toHaveBeenCalledWith('[useComponentLifecycle] mounted at 100.00 ms');
    expect(console.log).toHaveBeenCalledWith('[useComponentLifecycle] unmounted at 250.00 ms (alive 150.00 ms)');
  });

  it('includes componentName in log output when provided', () => {
    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(200);

    const { unmount } = renderHook(() => useComponentLifecycle('ChartPanel'));

    nowSpy.mockReturnValue(260);
    unmount();

    expect(console.log).toHaveBeenCalledWith('[useComponentLifecycle:ChartPanel] mounted at 200.00 ms');
    expect(console.log).toHaveBeenCalledWith(
      '[useComponentLifecycle:ChartPanel] unmounted at 260.00 ms (alive 60.00 ms)'
    );
  });

  it('does not emit mount or unmount logs in production mode', () => {
    process.env.NODE_ENV = 'production';

    const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(50);

    const { unmount } = renderHook(() => useComponentLifecycle('SilentInProd'));

    nowSpy.mockReturnValue(90);
    unmount();

    expect(console.log).not.toHaveBeenCalled();
  });
});
