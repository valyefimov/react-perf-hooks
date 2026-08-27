import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhyDidYouUpdate } from './index';

describe('useWhyDidYouUpdate', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.spyOn(console, 'group').mockImplementation(() => {});
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('returns an empty array on first render (no previous props to diff)', () => {
    const { result } = renderHook(() => useWhyDidYouUpdate('Test', { a: 1 }));
    expect(result.current).toEqual([]);
    expect(console.group).not.toHaveBeenCalled();
  });

  it('detects a primitive value change', () => {
    let props = { count: 1 };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));

    props = { count: 2 };
    rerender();

    expect(result.current).toEqual([
      { key: 'count', previousValue: 1, currentValue: 2, referenceChangedOnly: false },
    ]);
  });

  it('returns an empty array when nothing changed', () => {
    const props = { count: 1 };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));

    rerender();

    expect(result.current).toEqual([]);
  });

  it('flags a new object reference with identical data as [Reference Changed Only] when deepCheck is on', () => {
    let props: Record<string, unknown> = { config: { a: 1, b: 2 } };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { deepCheck: true }),
    );

    props = { config: { a: 1, b: 2 } };
    rerender();

    expect(result.current).toEqual([
      {
        key: 'config',
        previousValue: { a: 1, b: 2 },
        currentValue: { a: 1, b: 2 },
        referenceChangedOnly: true,
      },
    ]);
  });

  it('does not flag reference-only changes when deepCheck is off', () => {
    let props: Record<string, unknown> = { config: { a: 1, b: 2 } };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));

    props = { config: { a: 1, b: 2 } };
    rerender();

    expect(result.current).toEqual([
      {
        key: 'config',
        previousValue: { a: 1, b: 2 },
        currentValue: { a: 1, b: 2 },
        referenceChangedOnly: false,
      },
    ]);
  });

  it('reports referenceChangedOnly false when the underlying data actually changed', () => {
    let props: Record<string, unknown> = { config: { a: 1 } };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { deepCheck: true }),
    );

    props = { config: { a: 2 } };
    rerender();

    expect(result.current[0].referenceChangedOnly).toBe(false);
  });

  it('detects keys added or removed between renders', () => {
    let props: Record<string, unknown> = { a: 1 };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));

    props = { a: 1, b: 2 };
    rerender();

    expect(result.current).toEqual([
      { key: 'b', previousValue: undefined, currentValue: 2, referenceChangedOnly: false },
    ]);
  });

  it('uses Object.is semantics — NaN equals NaN (no false positive)', () => {
    const props = { value: NaN };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));
    rerender();

    expect(result.current).toEqual([]);
  });

  it('logs via console.group when logType is "console" (default)', () => {
    let props = { count: 1 };
    const { rerender } = renderHook(() => useWhyDidYouUpdate('HeavyList', props));

    props = { count: 2 };
    rerender();

    expect(console.group).toHaveBeenCalledWith(expect.stringContaining('HeavyList'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"count" changed'), {
      previousValue: 1,
      currentValue: 2,
    });
    expect(console.groupEnd).toHaveBeenCalled();
  });

  it('logs [Reference Changed Only] label for reference-only diffs', () => {
    let props: Record<string, unknown> = { config: { a: 1 } };
    const { rerender } = renderHook(() =>
      useWhyDidYouUpdate('HeavyList', props, { deepCheck: true }),
    );

    props = { config: { a: 1 } };
    rerender();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Reference Changed Only]'),
      expect.anything(),
    );
  });

  it('does not log when logType is "object"', () => {
    let props = { count: 1 };
    const { rerender } = renderHook(() => useWhyDidYouUpdate('Test', props, { logType: 'object' }));

    props = { count: 2 };
    rerender();

    expect(console.group).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  });

  it('is a noop and returns an empty array when disabled', () => {
    let props = { count: 1 };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { enabled: false }),
    );

    props = { count: 2 };
    rerender();

    expect(result.current).toEqual([]);
    expect(console.group).not.toHaveBeenCalled();
  });

  it('does not blow the stack on circular references when deepCheck is on', () => {
    const previous: Record<string, unknown> = { a: 1 };
    previous.self = previous;
    const current: Record<string, unknown> = { a: 1 };
    current.self = current;

    let props: Record<string, unknown> = { data: previous };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { deepCheck: true }),
    );

    props = { data: current };
    expect(() => rerender()).not.toThrow();
    expect(result.current[0].referenceChangedOnly).toBe(true);
  });

  it('detects a key removed when the value is explicitly undefined', () => {
    let props: Record<string, unknown> = { flag: undefined };
    const { result, rerender } = renderHook(() => useWhyDidYouUpdate('Test', props));

    props = {};
    rerender();

    expect(result.current).toEqual([
      {
        key: 'flag',
        previousValue: undefined,
        currentValue: undefined,
        referenceChangedOnly: false,
      },
    ]);
  });

  it('does not treat structures beyond maxDepth as reference-only', () => {
    let props: Record<string, unknown> = { data: { a: { b: { c: 1 } } } };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { deepCheck: true, maxDepth: 1 }),
    );

    props = { data: { a: { b: { c: 2 } } } };
    rerender();

    expect(result.current[0].referenceChangedOnly).toBe(false);
  });

  it('each hook instance tracks its own independent previous props', () => {
    let propsA = { a: 1 };
    let propsB = { b: 1 };
    const hookA = renderHook(() => useWhyDidYouUpdate('A', propsA));
    const hookB = renderHook(() => useWhyDidYouUpdate('B', propsB));

    propsA = { a: 2 };
    hookA.rerender();

    expect(hookA.result.current).toEqual([
      { key: 'a', previousValue: 1, currentValue: 2, referenceChangedOnly: false },
    ]);
    expect(hookB.result.current).toEqual([]);

    propsB = { b: 1 };
    hookB.rerender();
    expect(hookB.result.current).toEqual([]);
  });

  it('is a static no-op in production, even with enabled: true', () => {
    process.env.NODE_ENV = 'production';

    let props = { count: 1 };
    const { result, rerender } = renderHook(() =>
      useWhyDidYouUpdate('Test', props, { enabled: true, deepCheck: true }),
    );

    props = { count: 2 };
    rerender();

    expect(result.current).toEqual([]);
    expect(console.group).not.toHaveBeenCalled();
  });
});
