import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRenderCount } from './index';

describe('useRenderCount', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 1 on the first render', () => {
    const { result } = renderHook(() => useRenderCount('Test'));
    expect(result.current).toBe(1);
  });

  it('increments the count on every render', () => {
    const { result, rerender } = renderHook(() => useRenderCount('Test'));

    rerender();
    rerender();
    rerender();

    expect(result.current).toBe(4);
  });

  it('does not log by default', () => {
    const { rerender } = renderHook(() => useRenderCount('Test'));
    rerender();

    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs the running count on every render when logOnRender is true', () => {
    const { rerender } = renderHook(() => useRenderCount('Test', { logOnRender: true }));
    rerender();

    expect(console.log).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenLastCalledWith('[useRenderCount] "Test" rendered 2 times');
  });

  it('warns exactly once when the render count reaches thresholdWarning', () => {
    const { rerender } = renderHook(() => useRenderCount('Test', { thresholdWarning: 2 }));

    expect(console.warn).not.toHaveBeenCalled();

    rerender();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[useRenderCount] "Test" has rendered 2 times, reaching the warning threshold of 2.',
    );

    rerender();
    rerender();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('returns a frozen count and skips logging/warning when disabled', () => {
    const { result, rerender } = renderHook(() =>
      useRenderCount('Test', { enabled: false, logOnRender: true, thresholdWarning: 1 }),
    );

    rerender();
    rerender();

    expect(result.current).toBe(0);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
