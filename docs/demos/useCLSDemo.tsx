import React, { useState } from 'react';
import { useCLS } from 'react-perf-hooks';

export function UseCLSDemo() {
  const [showHero, setShowHero] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const { ref, value, rating, entries, isSupported } = useCLS<HTMLDivElement>({
    onMetric: (metric) => {
      console.info('[useCLS demo]', metric);
    },
  });

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '0 auto' }}>
      <h2>useCLS demo</h2>
      <p>Toggle delayed content inside the observed card to see component-level layout shift attribution.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" onClick={() => setShowHero((current) => !current)}>
          Toggle unreserved media
        </button>
        <button type="button" onClick={() => setShowNotice((current) => !current)}>
          Toggle notice
        </button>
      </div>

      <div
        ref={ref}
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          padding: 16,
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Observed product card</h3>
        {showHero ? (
          <div
            style={{
              height: 140,
              marginBottom: 12,
              background: 'linear-gradient(135deg, #0f766e, #2563eb)',
              borderRadius: 6,
            }}
          />
        ) : null}
        <p style={{ margin: '0 0 12px' }}>
          This card intentionally inserts content without reserving space so supported browsers can emit
          layout-shift entries.
        </p>
        {showNotice ? (
          <p style={{ margin: '0 0 12px', padding: 10, background: '#fef3c7', borderRadius: 6 }}>
            Dynamic notice loaded after initial content.
          </p>
        ) : null}
        <strong>Component CLS:</strong>{' '}
        {isSupported ? `${value.toFixed(3)} (${rating ?? 'waiting'})` : 'layout-shift unsupported'}
      </div>

      <dl>
        <dt>Matching entries</dt>
        <dd>{entries.length}</dd>
        <dt>Latest delta</dt>
        <dd>{entries.at(-1)?.delta.toFixed(3) ?? 'waiting'}</dd>
      </dl>
    </section>
  );
}

export default UseCLSDemo;
