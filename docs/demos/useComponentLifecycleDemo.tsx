import { useState } from 'react';
import { useComponentLifecycle } from 'react-perf-hooks';

function LifecycleCard({ renderTick }: { renderTick: number }) {
  const { mountedAt, aliveMs } = useComponentLifecycle('LifecycleCard');

  return (
    <div
      style={{
        border: '1px solid #d4d4d8',
        borderRadius: 12,
        padding: 16,
        background: 'linear-gradient(180deg, #f8fafc, #eef2ff)',
      }}
    >
      <strong>LifecycleCard</strong>
      <div style={{ marginTop: 8, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div>Parent render tick: {renderTick}</div>
        <div>Mounted at: {mountedAt.toFixed(1)} ms</div>
        <div>Alive: {aliveMs.toFixed(1)} ms</div>
      </div>
    </div>
  );
}

export function UseComponentLifecycleDemo() {
  const [renderTick, setRenderTick] = useState(0);
  const [showCard, setShowCard] = useState(true);

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setRenderTick((value) => value + 1)}>
          Re-render card
        </button>
        <button type="button" onClick={() => setShowCard((value) => !value)}>
          {showCard ? 'Unmount card' : 'Mount card'}
        </button>
      </div>

      {showCard ? (
        <LifecycleCard renderTick={renderTick} />
      ) : (
        <p style={{ margin: 0, color: '#52525b' }}>Card is unmounted. Check the dev console for lifecycle logs.</p>
      )}
    </section>
  );
}
