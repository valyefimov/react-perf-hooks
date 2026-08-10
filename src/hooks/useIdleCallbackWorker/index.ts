import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A pure, serializable task. It must not close over outer scope because it may
 * be stringified and re-instantiated inside a Web Worker where no closure state
 * exists. Receives the same arguments passed to `execute`.
 */
export type IdleWorkerTask<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => TResult | Promise<TResult>;

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
  /** Whether a task is currently in flight. */
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

/**
 * Builds the source for an inline worker that reconstructs the task from its
 * string form and posts the result (or error) back to the main thread.
 */
function buildWorkerSource(taskSource: string): string {
  return `
    const __task = (${taskSource});
    self.onmessage = async (event) => {
      try {
        const result = await __task(...event.data);
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
        reject(new Error(event.message || 'useIdleCallbackWorker: worker crashed'));
      };

      worker.postMessage(args);
    } catch (err) {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
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

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`useIdleCallbackWorker: task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    requestIdle(
      () => {
        if (settled) return;

        Promise.resolve()
          .then(() => task(...args))
          .then((value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          })
          .catch((err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      },
      { timeout: timeoutMs },
    );
  });
}

/**
 * Offloads a heavy, synchronous task off the critical rendering path to keep
 * INP and frame timing healthy. Prefers an inline Web Worker (true parallelism)
 * and transparently falls back to `requestIdleCallback` scheduling when Workers
 * are unavailable, such as during SSR or in restricted environments.
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

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult> => {
      const currentTask = taskRef.current;
      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      const canWorker = strategy === 'worker' || (strategy === 'auto' && supportsWorker());

      try {
        const value = canWorker
          ? await runInWorker<TArgs, TResult>(currentTask.toString(), args, timeoutMs)
          : await runOnIdle<TArgs, TResult>(currentTask, args, timeoutMs);

        if (mountedRef.current) {
          setResult(value);
          setLoading(false);
        }
        return value;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(normalized);
          setLoading(false);
        }
        throw normalized;
      }
    },
    [strategy, timeoutMs],
  );

  return { execute, loading, result, error };
}
