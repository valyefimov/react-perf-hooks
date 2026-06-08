import React, { useState } from 'react';
import { useFps } from 'react-perf-hooks';

export function UseFpsDemo() {
  const [drops, setDrops] = useState<number[]>([]);
  const { fps, isLowPerformance, isSupported } = useFps({
    threshold: 30,
    windowSize: 5,
    onDrop: (currentFps) => {
      setDrops((previous) => [currentFps, ...previous].slice(0, 5));
    },
  });

  return (
    <section style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 560, margin: '0 auto' }}>
      <h2>useFps demo</h2>
      <p>Monitor rolling-averaged FPS and switch to a lighter UI when the frame rate falls below 30 FPS.</p>

      {!isSupported ? (
        <p>requestAnimationFrame is not available in this browser.</p>
      ) : (
        <>
          <style>{`
            @keyframes use-fps-spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>

          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              background: isLowPerformance ? '#fff7ed' : '#ecfdf5',
            }}
          >
            <strong>{isLowPerformance ? 'Static fallback enabled' : 'Animated experience enabled'}</strong>
            <div style={{ marginTop: 8 }}>FPS: {fps === 0 ? 'measuring...' : fps.toFixed(0)}</div>
          </div>

          {isLowPerformance ? <StaticFallback /> : <AnimatedPreview />}

          <button type="button" onClick={() => blockMainThread(240)} style={{ marginTop: 16 }}>
            Simulate 240ms main-thread block
          </button>

          <h3>Recent drops</h3>
          {drops.length === 0 ? (
            <p>No FPS drops reported yet.</p>
          ) : (
            <ul>
              {drops.map((drop, index) => (
                <li key={`${drop}-${index}`}>{drop.toFixed(1)} FPS</li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function AnimatedPreview() {
  return (
    <div
      style={{
        width: 96,
        height: 96,
        borderRadius: 999,
        background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
        animation: 'use-fps-spin 900ms linear infinite',
      }}
    />
  );
}

function StaticFallback() {
  return (
    <div
      style={{
        width: 96,
        height: 96,
        borderRadius: 999,
        background: 'linear-gradient(135deg, #f97316, #c2410c)',
      }}
    />
  );
}

function blockMainThread(duration: number): void {
  const end = performance.now() + duration;
  while (performance.now() < end) {
    // Intentionally block the main thread so the demo can show adaptive degradation.
  }
}
