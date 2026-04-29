import { useIntersectionObserver } from 'react-perf-hooks';

export function UseIntersectionObserverDemo() {
  const { ref, isVisible, metrics } = useIntersectionObserver<HTMLDivElement>({
    threshold: 0.5,
  });

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 480 }}>
      <p style={{ marginTop: 0 }}>
        Scroll the panel until the highlighted card is at least 50% visible.
      </p>

      <div
        style={{
          height: 240,
          overflowY: 'auto',
          border: '1px solid #d4d4d8',
          borderRadius: 12,
          padding: 12,
          background: 'linear-gradient(180deg, #fafaf9, #f4f4f5)',
        }}
      >
        <div style={{ height: 180, display: 'grid', placeItems: 'center', color: '#71717a' }}>
          Scroll down
        </div>

        <div
          ref={ref}
          style={{
            minHeight: 140,
            borderRadius: 12,
            padding: 16,
            background: isVisible ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)' : 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
          }}
        >
          <strong>Observed card</strong>
          <div style={{ marginTop: 8 }}>
            {isVisible ? 'Visible now' : 'Below the visibility threshold'}
          </div>
        </div>

        <div style={{ height: 220, display: 'grid', placeItems: 'center', color: '#71717a' }}>
          Keep scrolling
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 4,
          marginTop: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        <div>Visible: {String(isVisible)}</div>
        <div>First visible at: {metrics.firstVisibleAt?.toFixed(1) ?? 'not yet'} ms</div>
        <div>Total visible: {metrics.totalVisibleMs.toFixed(1)} ms</div>
      </div>
    </section>
  );
}
