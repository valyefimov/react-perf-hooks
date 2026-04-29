import { useState } from 'react';
import { useThrottledState } from 'react-perf-hooks';

export function UseThrottledStateDemo() {
  const [leading, setLeading] = useState(true);
  const [trailing, setTrailing] = useState(true);
  const [point, setPoint, stats] = useThrottledState({ x: 0, y: 0 }, 120, { leading, trailing });

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={leading}
            disabled={!trailing}
            onChange={(event) => setLeading(event.target.checked)}
          />
          Leading
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={trailing}
            disabled={!leading}
            onChange={(event) => setTrailing(event.target.checked)}
          />
          Trailing
        </label>
      </div>

      <div
        onPointerMove={(event) => setPoint({ x: Math.round(event.clientX), y: Math.round(event.clientY) })}
        style={{
          height: 180,
          border: '1px solid #d4d4d8',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          background: 'linear-gradient(135deg, #f8fafc, #eef2ff)',
        }}
      >
        Move your pointer around this box quickly.
      </div>

      <div style={{ display: 'grid', gap: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div>
          Committed point: {point.x}, {point.y}
        </div>
        <div>Total updates: {stats.totalUpdates}</div>
        <div>Dropped updates: {stats.droppedUpdates}</div>
      </div>
    </section>
  );
}
