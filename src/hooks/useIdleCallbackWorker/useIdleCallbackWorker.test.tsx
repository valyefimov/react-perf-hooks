import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useIdleCallbackWorker } from './index';

// jsdom has no real Worker, so tests exercise the requestIdleCallback path by
// forcing the `idle` strategy, plus SSR safety and error handling.

describe('useIdleCallbackWorker', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestIdleCallback',
      (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void): number => {
        cb({ didTimeout: false, timeRemaining: () => 50 });
        return 1;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves with the task result on the idle path', async () => {
    const task = (items: number[]): number => items.reduce((sum, n) => sum + n, 0);
    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'idle' }));

    let value: number | undefined;
    await act(async () => {
      value = await result.current.execute([1, 2, 3, 4]);
    });

    expect(value).toBe(10);
    expect(result.current.result).toBe(10);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('supports async tasks', async () => {
    const task = async (n: number): Promise<number> => n * 2;
    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'idle' }));

    let value: number | undefined;
    await act(async () => {
      value = await result.current.execute(21);
    });

    expect(value).toBe(42);
  });

  it('captures errors thrown inside the task', async () => {
    const task = (): number => {
      throw new Error('boom');
    };
    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'idle' }));

    await act(async () => {
      await expect(result.current.execute()).rejects.toThrow('boom');
    });

    expect(result.current.error?.message).toBe('boom');
    expect(result.current.loading).toBe(false);
  });

  it('rejects when the idle task exceeds the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', (): number => 1); // never invokes the callback

    const task = (): number => 1;
    const { result } = renderHook(() =>
      useIdleCallbackWorker(task, { strategy: 'idle', timeoutMs: 100 }),
    );

    let rejection: Promise<unknown>;
    act(() => {
      rejection = result.current.execute();
      rejection.catch(() => undefined);
    });

    await act(async () => {
      vi.advanceTimersByTime(101);
    });

    await expect(rejection!).rejects.toThrow(/timed out/);
    vi.useRealTimers();
  });

  it('does not crash during SSR (no window)', () => {
    const task = (n: number): number => n;
    expect(() => renderToString(<SsrProbe task={task} />)).not.toThrow();
  });

  it('drives a generator task across multiple idle callbacks', async () => {
    let idleCalls = 0;
    vi.stubGlobal(
      'requestIdleCallback',
      (cb: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void): number => {
        idleCalls += 1;
        // Time remaining is only positive for the first read, so each idle
        // callback advances exactly one generator step.
        let reads = 0;
        cb({ didTimeout: false, timeRemaining: () => (reads++ === 0 ? 1 : 0) });
        return idleCalls;
      },
    );

    function* task(items: number[]): Generator<void, number, void> {
      let sum = 0;
      for (const item of items) {
        sum += item;
        yield;
      }
      return sum;
    }

    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'idle' }));

    let value: number | undefined;
    await act(async () => {
      value = await result.current.execute([1, 2, 3, 4]);
    });

    expect(value).toBe(10);
    expect(idleCalls).toBeGreaterThan(1);
  });

  it('falls back to the idle path when the worker fails to start', async () => {
    class FailingWorker {
      constructor() {
        throw new Error('CSP blocked worker');
      }
    }
    vi.stubGlobal('Worker', FailingWorker);
    vi.stubGlobal('Blob', class {} as unknown as typeof Blob);
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:mock',
      revokeObjectURL: () => undefined,
    });

    const task = (n: number): number => n * 2;
    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'worker' }));

    let value: number | undefined;
    await act(async () => {
      value = await result.current.execute(21);
    });

    expect(value).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('keeps loading true until all overlapping executions settle', async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const task = async (id: number): Promise<number> => {
      if (id === 1) await first;
      return id;
    };
    const { result } = renderHook(() => useIdleCallbackWorker(task, { strategy: 'idle' }));

    let firstDone: Promise<number>;
    let secondDone: Promise<number>;
    act(() => {
      firstDone = result.current.execute(1);
      secondDone = result.current.execute(2);
    });

    await act(async () => {
      await secondDone;
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFirst();
      await firstDone;
    });

    expect(result.current.loading).toBe(false);
  });
});

function SsrProbe({ task }: { task: (n: number) => number }): null {
  useIdleCallbackWorker(task);
  return null;
}
