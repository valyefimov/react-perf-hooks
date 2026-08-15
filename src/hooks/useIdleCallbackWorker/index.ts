import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A pure, serializable task. It must not close over outer scope because it may
 * be stringified and re-instantiated inside a Web Worker where no closure state
 * exists. Receives the same arguments passed to `execute`.
 *
 * To get real cooperative chunking on the `requestIdleCallback` fallback path
 * (no Worker support), author the task as a generator function that yields
 * periodically between chunks of work and returns the final result. Plain
 * sync/async tasks still run off the critical path but execute atomically
 * once idle time is available, since arbitrary synchronous code cannot be
 * interrupted mid-execution.
 */
export type IdleWorkerTask<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => TResult | Promise<TResult> | Generator<unknown, TResult, unknown>;

export type IdleWorkerStrategy = 'auto' | 'worker' | 'idle';

export interface UseIdleCallbackWorkerOptions {
  /**
   * Execution strategy. `auto` prefers a Web Worker and falls back to
   * `requestIdleCallback` chunking on the main thread. Defaults to `auto`.
   */
  strategy?: IdleWorkerStrategy;
  /** Deadline in ms for a single idle chunk before yielding. Defaults to 8ms. */
  chunkBudgetMs?: number;
  /** Timeout in ms after which a pending task is rejected. Defaults to 30000ms. */
  timeoutMs?: number;
}

export interface UseIdleCallbackWorkerReturn<TArgs extends unknown[], TResult> {
  /** Runs the task off the critical path and resolves with its result. */
  execute: (...args: TArgs) => Promise<TResult>;
  /** Whether at least one task is currently in flight. */
  loading: boolean;
  /** The most recent successful result, or null before the first run. */
  result: TResult | null;
  /** The most recent error, or null when the last run succeeded. */
  error: Error | null;
}

interface IdleDeadline {
  didTimeout: boolean;
  timeRemaining: () => number;
}

type RequestIdleCallback = (
  callback: (deadline: IdleDeadline) => void,
  options?: { timeout: number },
) => number;

const DEFAULT_CHUNK_BUDGET_MS = 8;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Signals that the Worker itself failed to start (blocked by CSP, parse error, etc.), as opposed to the task throwing inside a running worker. Callers use this to safely retry on the idle fallback without re-running an already-executed task. */
class WorkerStartError extends Error {}

function supportsWorker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

function getRequestIdleCallback(): RequestIdleCallback {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback.bind(window) as RequestIdleCallback;
  }

  // Polyfill for browsers (Safari) and environments without requestIdleCallback.
  return (callback) => {
    const start = Date.now();
    return setTimeout(() => {
      callback({
        didTimeout: false,
        timeRemaining: () => Math.max(0, DEFAULT_CHUNK_BUDGET_MS - (Date.now() - start)),
      });
    }, 1) as unknown as number;
  };
}

function isGenerator<TResult>(value: unknown): value is Generator<unknown, TResult, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Iterator<unknown>).next === 'function' &&
    typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
  );
}

/**
 * Builds the source for an inline worker that reconstructs the task from its
 * string form and posts the result (or error) back to the main thread. Inside
 * the worker, a generator task is driven to completion synchronously since
 * there is no main-thread frame budget to protect there.
 */
function buildWorkerSource(taskSource: string): string {
  return `
    const __task = (${taskSource});
    self.onmessage = async (event) => {
      try {
        let outcome = __task(...event.data);
        if (outcome && typeof outcome.next === 'function' && typeof outcome[Symbol.iterator] === 'function') {
          let step = outcome.next();
          while (!step.done) step = outcome.next();
          outcome = step.value;
        }
        const result = await outcome;
        self.postMessage({ ok: true, result });
      } catch (err) {
        self.postMessage({ ok: false, error: (err && err.message) || String(err) });
      }
    };
  `;
}

function runInWorker<TArgs extends unknown[], TResult>(
  taskSource: string,
  args: TArgs,
  timeoutMs: number,
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    let url: string | null = null;
    let worker: Worker | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let started = false;

    const cleanup = (): void => {
      if (timer !== null) clearTimeout(timer);
      if (worker !== null) worker.terminate();
      if (url !== null) URL.revokeObjectURL(url);
    };

    try {
      const blob = new Blob([buildWorkerSource(taskSource)], { type: 'application/javascript' });
      url = URL.createObjectURL(blob);
      worker = new Worker(url);

      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`useIdleCallbackWorker: task timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.onmessage = (event: MessageEvent) => {
        started = true;
        cleanup();
        const data = event.data as { ok: boolean; result?: TResult; error?: string };
        if (data.ok) {
          resolve(data.result as TResult);
        } else {
          reject(new Error(data.error ?? 'useIdleCallbackWorker: worker task failed'));
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        cleanup();
        // An error before any message came back means the worker never
        // actually ran the task (blocked by CSP, syntax error, etc.), so
        // callers can safely retry on the idle fallback path.
        const message = event.message || 'useIdleCallbackWorker: worker crashed';
        reject(started ? new Error(message) : new WorkerStartError(message));
      };

      worker.postMessage(args);
    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : String(err);
      reject(new WorkerStartError(message));
    }
  });
}

function runOnIdle<TArgs extends unknown[], TResult>(
  task: IdleWorkerTask<TArgs, TResult>,
  args: TArgs,
  timeoutMs: number,
): Promise<TResult> {
  const requestIdle = getRequestIdleCallback();

  return new Promise<TResult>((resolve, reject) => {
    let settled = false;
    let iterator: Iterator<unknown, TResult, unknown> | null = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`useIdleCallbackWorker: task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const finish = (value: TResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const fail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    // Drives a generator task across successive idle callbacks, only
    // advancing while the current idle deadline has time remaining.
    const stepGenerator = (deadline: IdleDeadline): void => {
      if (settled || iterator === null) return;

      try {
        let step = iterator.next();
        while (!step.done && deadline.timeRemaining() > 0 && !deadline.didTimeout) {
          step = iterator.next();
        }

        if (step.done) {
          finish(step.value);
          return;
        }
      } catch (err) {
        fail(err);
        return;
      }

      requestIdle(stepGenerator, { timeout: timeoutMs });
    };

    requestIdle(
      (deadline) => {
        if (settled) return;

        try {
          const outcome = task(...args);

          if (isGenerator<TResult>(outcome)) {
            iterator = outcome;
            stepGenerator(deadline);
            return;
          }

          Promise.resolve(outcome).then(finish, fail);
        } catch (err) {
          fail(err);
        }
      },
      { timeout: timeoutMs },
    );
  });
}

/**
 * Offloads a heavy task off the critical rendering path to keep INP and frame
 * timing healthy. Prefers an inline Web Worker (true parallelism) and
 * transparently falls back to `requestIdleCallback` scheduling when Workers
 * are unavailable or fail to start, such as during SSR or under a
 * restrictive CSP.
 */
export function useIdleCallbackWorker<TArgs extends unknown[], TResult>(
  task: IdleWorkerTask<TArgs, TResult>,
  options: UseIdleCallbackWorkerOptions = {},
): UseIdleCallbackWorkerReturn<TArgs, TResult> {
  const { strategy = 'auto', timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tracks concurrently in-flight executions so overlapping calls to
  // `execute` don't clear `loading` while a sibling call is still running.
  const activeCountRef = useRef(0);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      const currentTask = taskRef.current;
      activeCountRef.current += 1;
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const canWorker = strategy === 'worker' || (strategy === 'auto' && supportsWorker());

      try {
        const value = canWorker
          ? await runInWorker<TArgs, TResult>(currentTask.toString(), args, timeoutMs).catch(
              (err: unknown) => {
                if (err instanceof WorkerStartError) {
                  return runOnIdle<TArgs, TResult>(currentTask, args, timeoutMs);
                }
                throw err;
              },
            )
          : await runOnIdle<TArgs, TResult>(currentTask, args, timeoutMs);

        if (mountedRef.current) {
          setResult(value);
        }
        return value;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(normalized);
        }
        throw normalized;
      } finally {
        activeCountRef.current -= 1;
        if (mountedRef.current && activeCountRef.current === 0) {
          setLoading(false);
        }
      }
    },
    [strategy, timeoutMs],
  );

  return { execute, loading, result, error };
}
