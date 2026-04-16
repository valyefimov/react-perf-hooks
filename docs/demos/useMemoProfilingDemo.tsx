import { useState } from 'react';
import { getStats, useMemoProfiling } from 'react-perf-hooks';

const items = [
  'React',
  'Vue',
  'Svelte',
  'Angular',
  'Solid',
  'Qwik',
  'Preact',
  'Lit',
  'Remix',
  'Next.js',
  'Nuxt',
  'Astro',
];

export function UseMemoProfilingDemo() {
  const [query, setQuery] = useState('r');
  const [uiTick, setUiTick] = useState(0);
  const label = 'FrameworkFilter';

  const filteredItems = useMemoProfiling(
    () => {
      const lowered = query.trim().toLowerCase();
      return items.filter((item) => item.toLowerCase().includes(lowered));
    },
    [query],
    label
  );

  const stats = getStats(label);

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 520 }}>
      <label htmlFor="memo-query" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
        Filter frameworks
      </label>

      <input
        id="memo-query"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a query..."
        style={{ width: '100%', padding: '8px 10px', marginBottom: 10 }}
      />

      <button type="button" onClick={() => setUiTick((value) => value + 1)} style={{ marginBottom: 12 }}>
        Force unrelated re-render ({uiTick})
      </button>

      <div style={{ display: 'grid', gap: 4, marginBottom: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div>Hits: {stats.hits}</div>
        <div>Misses: {stats.misses}</div>
        <div>Avg miss cost: {stats.averageRecomputeMs.toFixed(2)} ms</div>
      </div>

      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {filteredItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
