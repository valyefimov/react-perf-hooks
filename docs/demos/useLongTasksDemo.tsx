import React from 'react';
import { useLongTasks } from 'react-perf-hooks';

export function UseLongTasksDemo() {
  const { latest, count, totalBlockingTime, isSupported } = useLongTasks({
    screen: 'long-tasks-demo',
    minDuration: 50,
    onLongTask: (metric) => {
      console.info('[useLongTasks demo]', metric);
    },
  });

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto' }}>
      <h2>useLongTasks demo</h2>
      <p>Click a button to block the main thread and generate Long Tasks API entries.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" onClick={() => expensiveWork(80)}>
          Simulate 80ms freeze
        </button>
        <button type="button" onClick={() => expensiveWork(180)}>
          Simulate 180ms freeze
        </button>
      </div>

      {!isSupported ? (
        <p>Long Tasks API is not supported in this browser.</p>
      ) : (
        <dl>
          <dt>Observed long tasks</dt>
          <dd>{count}</dd>
          <dt>Total blocking time</dt>
          <dd>{totalBlockingTime.toFixed(0)} ms</dd>
          <dt>Latest freeze</dt>
          <dd>{latest ? `${latest.duration.toFixed(0)} ms on ${latest.screen}` : 'waiting'}</dd>
        </dl>
      )}
    </section>
  );
}

function expensiveWork(duration: number): void {
  const end = performance.now() + duration;
  while (performance.now() < end) {
    // Intentionally block the main thread so the demo emits longtask entries.
  }
}

export default UseLongTasksDemo;
