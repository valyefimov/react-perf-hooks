import { useMemo } from 'react';
import { useIdleCallbackWorker } from 'react-perf-hooks';

// Pure task — safe to stringify and run inside a Web Worker.
function sumHeavy(rows: number[], min: number): { count: number; total: number } {
  let count = 0;
  let total = 0;
  for (const value of rows) {
    if (value >= min) {
      count += 1;
      total += value;
    }
  }
  return { count, total };
}

export function UseIdleCallbackWorkerDemo() {
  const rows = useMemo(
    () => Array.from({ length: 200_000 }, (_, index) => (index * 7919) % 100_000),
    [],
  );
  const { execute, loading, result, error } = useIdleCallbackWorker(sumHeavy);

  const run = async () => {
    try {
      await execute(rows, 50_000);
    } catch {
      // surfaced via the error field below
    }
  };

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 480 }}>
      <p style={{ marginTop: 0 }}>
        Filters and sums 200,000 numbers off the main thread. The button stays responsive because
        the work runs in a Web Worker (or on idle time as a fallback).
      </p>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          background: loading ? '#94a3b8' : '#0f172a',
          color: '#ffffff',
          padding: '8px 14px',
          cursor: loading ? 'progress' : 'pointer',
        }}
      >
        {loading ? 'Processing…' : 'Run heavy task'}
      </button>

      <div
        style={{
          display: 'grid',
          gap: 4,
          marginTop: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <div>Loading: {String(loading)}</div>
        <div>Matched: {result ? result.count : 'not yet'}</div>
        <div>Total: {result ? result.total : 'not yet'}</div>
        {error && <div style={{ color: '#dc2626' }}>Error: {error.message}</div>}
      </div>
    </section>
  );
}
