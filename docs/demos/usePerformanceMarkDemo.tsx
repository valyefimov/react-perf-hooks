import React, { useState } from 'react';
import { usePerformanceMark } from 'react-perf-hooks';

export function UsePerformanceMarkDemo() {
  const { mark, measure } = usePerformanceMark('UsePerformanceMarkDemo');
  const [lastDuration, setLastDuration] = useState<number | null>(null);

  const simulateWork = async () => {
    mark('work-start');

    await new Promise((resolve) => setTimeout(resolve, 150 + Math.floor(Math.random() * 200)));

    mark('work-end');
    const result = measure('work-duration', 'work-start', 'work-end');
    setLastDuration(result?.duration ?? null);
  };

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto' }}>
      <h2>usePerformanceMark demo</h2>
      <p>Click to measure async work duration.</p>
      <button onClick={simulateWork}>Run measured task</button>
      <p>{lastDuration ? `Last duration: ${lastDuration.toFixed(2)} ms` : 'No measurement yet.'}</p>
    </section>
  );
}

export default UsePerformanceMarkDemo;
