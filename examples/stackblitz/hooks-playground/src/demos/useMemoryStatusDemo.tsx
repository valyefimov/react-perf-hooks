import { useMemoryStatus } from 'react-perf-hooks';

function formatBytes(value: number | null): string {
  if (value === null) return 'n/a';

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function UseMemoryStatusDemo() {
  const { usedJSHeapSize, totalJSHeapSize, memoryLimit, isRiskZone, isSupported } = useMemoryStatus(
    {
      warningThresholdRatio: 0.8,
      interval: 5000,
    },
  );

  return (
    <section>
      <h2>useMemoryStatus demo</h2>
      <p>
        Chromium exposes JavaScript heap telemetry through the non-standard performance.memory API.
        Safari and Firefox safely report unsupported.
      </p>
      <dl>
        <dt>Supported</dt>
        <dd>{isSupported ? 'Yes' : 'No'}</dd>
        <dt>Used heap</dt>
        <dd>{formatBytes(usedJSHeapSize)}</dd>
        <dt>Total heap</dt>
        <dd>{formatBytes(totalJSHeapSize)}</dd>
        <dt>Heap limit</dt>
        <dd>{formatBytes(memoryLimit)}</dd>
        <dt>Risk zone</dt>
        <dd>{isRiskZone ? 'Yes' : 'No'}</dd>
      </dl>
    </section>
  );
}
