import { useMemo, useState } from 'react';
import { useRenderBudget } from 'react-perf-hooks';

function SlowPreview({ size, budget }: { size: number; budget: number }) {
  useRenderBudget(budget, 'SlowPreview');

  const score = useMemo(() => {
    let total = 0;

    for (let i = 0; i < size * 12000; i += 1) {
      total += Math.sqrt((i % 1000) + 1);
    }

    return Math.round(total);
  }, [size]);

  return (
    <div
      style={{
        border: '1px solid #d4d4d8',
        borderRadius: 12,
        padding: 16,
        background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
      }}
    >
      <strong>SlowPreview render payload</strong>
      <div style={{ marginTop: 8 }}>Input size: {size}</div>
      <div>Computed score: {score.toLocaleString()}</div>
    </div>
  );
}

export function UseRenderBudgetDemo() {
  const [size, setSize] = useState(70);
  const [budget, setBudget] = useState(16);

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 520 }}>
      <p style={{ marginTop: 0 }}>
        Move either slider to trigger re-renders. Open the console to see warnings when render time exceeds budget.
      </p>

      <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <span>Workload size: {size}</span>
        <input type="range" min={20} max={140} value={size} onChange={(event) => setSize(Number(event.target.value))} />
      </label>

      <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        <span>Budget (ms): {budget}</span>
        <input
          type="range"
          min={4}
          max={40}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
        />
      </label>

      <SlowPreview size={size} budget={budget} />
    </section>
  );
}
