import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePerformanceMark } from './index';

describe('usePerformanceMark', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    performance.clearMarks();
    performance.clearMeasures();
  });

  it('calls performance.mark with the given name', () => {
    const spy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => usePerformanceMark());

    act(() => result.current.mark('start'));

    expect(spy).toHaveBeenCalledWith('start');
  });

  it('prepends namespace to mark names', () => {
    const spy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => usePerformanceMark('Comp'));

    act(() => result.current.mark('start'));

    expect(spy).toHaveBeenCalledWith('Comp:start');
  });

  it('works without a namespace', () => {
    const spy = vi.spyOn(performance, 'mark');
    const { result } = renderHook(() => usePerformanceMark());

    act(() => result.current.mark('checkpoint'));

    expect(spy).toHaveBeenCalledWith('checkpoint');
  });

  it('returns a result with name, duration, and startTime', () => {
    const { result } = renderHook(() => usePerformanceMark('test'));
    let measurement: ReturnType<typeof result.current.measure> = null;

    act(() => {
      result.current.mark('start');
      result.current.mark('end');
      measurement = result.current.measure('render', 'start', 'end');
    });

    expect(measurement).not.toBeNull();
    expect(measurement!.name).toBe('render');
    expect(typeof measurement!.duration).toBe('number');
    expect(measurement!.duration).toBeGreaterThanOrEqual(0);
    expect(typeof measurement!.startTime).toBe('number');
  });

  it('strips namespace from the returned result name', () => {
    const { result } = renderHook(() => usePerformanceMark('NS'));
    let measurement: ReturnType<typeof result.current.measure> = null;

    act(() => {
      result.current.mark('a');
      result.current.mark('b');
      measurement = result.current.measure('duration', 'a', 'b');
    });

    // User-facing name should not include the prefix
    expect(measurement!.name).toBe('duration');
  });

  it('measures from mark to current time when endMark is omitted', () => {
    const { result } = renderHook(() => usePerformanceMark('test'));
    let measurement: ReturnType<typeof result.current.measure> = null;

    act(() => {
      result.current.mark('start');
      measurement = result.current.measure('open-ended', 'start');
    });

    expect(measurement).not.toBeNull();
    expect(measurement!.duration).toBeGreaterThanOrEqual(0);
  });

  it('returns null and logs error when start mark does not exist', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePerformanceMark('test'));
    let measurement: ReturnType<typeof result.current.measure> = null;

    act(() => {
      measurement = result.current.measure('bad', 'ghost-mark');
    });

    expect(measurement).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[usePerformanceMark]'), expect.any(Error));
  });

  it('accumulates entries from multiple measure() calls', () => {
    const { result } = renderHook(() => usePerformanceMark('ns'));

    act(() => {
      result.current.mark('a');
      result.current.mark('b');
      result.current.mark('c');
      result.current.measure('a-to-b', 'a', 'b');
      result.current.measure('a-to-c', 'a', 'c');
    });

    const entries = result.current.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('a-to-b');
    expect(entries[1].name).toBe('a-to-c');
  });

  it('getEntries() returns an empty array initially', () => {
    const { result } = renderHook(() => usePerformanceMark());
    expect(result.current.getEntries()).toHaveLength(0);
  });

  it('getEntries() returns a stable array reference when nothing changed', () => {
    const { result } = renderHook(() => usePerformanceMark());
    const first = result.current.getEntries();
    const second = result.current.getEntries();
    // Same ref because nothing new was added
    expect(first).toBe(second);
  });

  it('calls clearMarks with namespaced name', () => {
    const spy = vi.spyOn(performance, 'clearMarks');
    const { result } = renderHook(() => usePerformanceMark('ns'));

    act(() => {
      result.current.mark('start');
      result.current.clearMarks('start');
    });

    expect(spy).toHaveBeenCalledWith('ns:start');
  });

  it('calls clearMarks with no args when no name provided', () => {
    const spy = vi.spyOn(performance, 'clearMarks');
    const { result } = renderHook(() => usePerformanceMark('ns'));

    act(() => result.current.clearMarks());

    expect(spy).toHaveBeenCalledWith();
  });

  it('calls clearMeasures with namespaced name', () => {
    const spy = vi.spyOn(performance, 'clearMeasures');
    const { result } = renderHook(() => usePerformanceMark('ns'));

    act(() => result.current.clearMeasures('render-time'));

    expect(spy).toHaveBeenCalledWith('ns:render-time');
  });

  it('calls clearMeasures with no args when no name provided', () => {
    const spy = vi.spyOn(performance, 'clearMeasures');
    const { result } = renderHook(() => usePerformanceMark());

    act(() => result.current.clearMeasures());

    expect(spy).toHaveBeenCalledWith();
  });

  it('mark and measure references are stable across re-renders', () => {
    const { result, rerender } = renderHook(() => usePerformanceMark('ns'));

    const markRef = result.current.mark;
    const measureRef = result.current.measure;

    rerender();

    expect(result.current.mark).toBe(markRef);
    expect(result.current.measure).toBe(measureRef);
  });
});
