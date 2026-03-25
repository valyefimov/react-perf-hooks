import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRenderTracker } from './index';

describe('useRenderTracker', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts at render count 1', () => {
    const { result } = renderHook(() => useRenderTracker());
    expect(result.current.count).toBe(1);
  });

  it('increments render count on each re-render', () => {
    const { result, rerender } = renderHook(() => useRenderTracker());
    rerender();
    expect(result.current.count).toBe(2);
    rerender();
    expect(result.current.count).toBe(3);
  });

  it('returns 0 for count when disabled', () => {
    const { result, rerender } = renderHook(() => useRenderTracker(undefined, { enabled: false }));
    rerender();
    rerender();
    expect(result.current.count).toBe(0);
  });

  it('returns a positive lastRenderTime when enabled', () => {
    const { result } = renderHook(() => useRenderTracker());
    expect(result.current.lastRenderTime).toBeGreaterThan(0);
  });

  it('returns 0 for lastRenderTime when disabled', () => {
    const { result } = renderHook(() => useRenderTracker(undefined, { enabled: false }));
    expect(result.current.lastRenderTime).toBe(0);
  });

  it('logs changed props on re-render', () => {
    let props = { name: 'Alice', age: 30 };
    const { rerender } = renderHook(() => useRenderTracker(props, { name: 'TestComponent' }));

    props = { name: 'Bob', age: 30 };
    rerender();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('TestComponent'),
      expect.arrayContaining(['name'])
    );
  });

  it('logs multiple changed props at once', () => {
    let props = { a: 1, b: 'x', c: true };
    const { rerender } = renderHook(() => useRenderTracker(props));

    props = { a: 2, b: 'y', c: true };
    rerender();

    expect(console.log).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['a', 'b']));
  });

  it('notes no prop changes when parent forces re-render', () => {
    const props = { value: 42 };
    const { rerender } = renderHook(() => useRenderTracker(props, { name: 'Stable' }));
    rerender();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No prop changes detected'));
  });

  it('uses Object.is semantics — NaN equals NaN (no false positive)', () => {
    const props = { value: NaN };
    const { rerender } = renderHook(() => useRenderTracker(props));
    rerender();

    // NaN === NaN via Object.is → no changed props logged
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No prop changes detected'));
  });

  it('uses Object.is semantics — detects null → undefined change', () => {
    let props: Record<string, unknown> = { id: null };
    const { rerender } = renderHook(() => useRenderTracker(props));

    props = { id: undefined };
    rerender();

    expect(console.log).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['id']));
  });

  it('does not log on first render (no previous props to diff)', () => {
    renderHook(() => useRenderTracker({ x: 1 }));
    // First render — no previous snapshot yet, nothing to diff
    expect(console.log).not.toHaveBeenCalled();
  });

  it('warns when render count reaches warnAt', () => {
    const { rerender } = renderHook(() => useRenderTracker(undefined, { name: 'Spammy', warnAt: 3 }));
    rerender(); // 2
    rerender(); // 3 — warn fires

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Spammy'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('3 times'));
  });

  it('does NOT warn before the warnAt threshold', () => {
    const { rerender } = renderHook(() => useRenderTracker(undefined, { warnAt: 5 }));
    rerender(); // 2
    rerender(); // 3
    rerender(); // 4

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('keeps warning on every render after warnAt is reached', () => {
    const { rerender } = renderHook(() => useRenderTracker(undefined, { warnAt: 2 }));
    rerender(); // 2 → warn
    rerender(); // 3 → warn again
    rerender(); // 4 → warn again

    expect(console.warn).toHaveBeenCalledTimes(3);
  });

  it('produces no console output when disabled', () => {
    const { rerender } = renderHook(() => useRenderTracker({ x: 1 }, { enabled: false }));
    rerender();

    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('each hook instance has its own independent counter', () => {
    const hook1 = renderHook(() => useRenderTracker());
    const hook2 = renderHook(() => useRenderTracker());

    hook1.rerender();
    hook1.rerender();

    expect(hook1.result.current.count).toBe(3);
    expect(hook2.result.current.count).toBe(1); // hook2 never re-rendered
  });
});
