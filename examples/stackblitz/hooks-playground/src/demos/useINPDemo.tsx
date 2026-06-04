import React from 'react';
import {useINP} from 'react-perf-hooks';

export function UseINPDemo() {
  const {metric, value, rating, isSupported} = useINP({durationThreshold: 16});

  return (
    <section style={{fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto'}}>
      <h2>useINP demo</h2>
      <p>Click the buttons or type in the input to generate Event Timing entries.</p>

      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16}}>
        <button type="button" onClick={() => expensiveWork(80)}>
          Simulate 80ms click
        </button>
        <button type="button" onClick={() => expensiveWork(220)}>
          Simulate 220ms click
        </button>
        <input placeholder="Type here" onKeyDown={() => expensiveWork(60)} />
      </div>

      {!isSupported ? (
        <p>Event Timing is not supported in this browser.</p>
      ) : (
        <dl>
          <dt>INP</dt>
          <dd>{value === null ? 'waiting' : `${value.toFixed(0)} ms (${rating})`}</dd>
          <dt>Worst event</dt>
          <dd>{metric ? metric.eventType : 'waiting'}</dd>
          <dt>Interaction ID</dt>
          <dd>{metric?.interactionId ?? 'not exposed yet'}</dd>
        </dl>
      )}
    </section>
  );
}

function expensiveWork(duration: number): void {
  const end = performance.now() + duration;
  while (performance.now() < end) {
    // Intentionally block the main thread so the demo has visible INP movement.
  }
}
