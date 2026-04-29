import React from 'react';
import { useWebVitals } from 'react-perf-hooks';

export function UseWebVitalsDemo() {
  const vitals = useWebVitals();

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '0 auto' }}>
      <h2>useWebVitals demo</h2>
      <p>Metrics populate as the browser reports them.</p>
      <ul>
        <li>LCP: {vitals.LCP ? `${vitals.LCP.value.toFixed(2)} (${vitals.LCP.rating})` : 'waiting'}</li>
        <li>CLS: {vitals.CLS ? `${vitals.CLS.value.toFixed(3)} (${vitals.CLS.rating})` : 'waiting'}</li>
        <li>INP: {vitals.INP ? `${vitals.INP.value.toFixed(2)} (${vitals.INP.rating})` : 'waiting'}</li>
        <li>FCP: {vitals.FCP ? `${vitals.FCP.value.toFixed(2)} (${vitals.FCP.rating})` : 'waiting'}</li>
        <li>TTFB: {vitals.TTFB ? `${vitals.TTFB.value.toFixed(2)} (${vitals.TTFB.rating})` : 'waiting'}</li>
      </ul>
    </section>
  );
}

export default UseWebVitalsDemo;
