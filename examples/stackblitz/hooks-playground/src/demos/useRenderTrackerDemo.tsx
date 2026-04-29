import React, { useState } from 'react';
import { useRenderTracker } from 'react-perf-hooks';

export function UseRenderTrackerDemo() {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState('Demo');

  const renderInfo = useRenderTracker({ count, label }, { name: 'UseRenderTrackerDemo', warnAt: 8 });

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto' }}>
      <h2>useRenderTracker demo</h2>
      <p>Component renders: {renderInfo.count}</p>
      <p>Last render time: {renderInfo.lastRenderTime.toFixed(2)} ms</p>

      <label htmlFor="label-input">Label</label>
      <input
        id="label-input"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        style={{ display: 'block', marginBottom: 12, width: '100%' }}
      />

      <button onClick={() => setCount((prev) => prev + 1)}>Increment ({count})</button>
    </section>
  );
}

export default UseRenderTrackerDemo;
