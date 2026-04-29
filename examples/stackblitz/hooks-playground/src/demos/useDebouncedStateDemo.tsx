import { useDebouncedState } from 'react-perf-hooks';

export function UseDebouncedStateDemo() {
  const [query, setQuery, stats] = useDebouncedState('', 250);

  return (
    <section style={{ fontFamily: 'system-ui', maxWidth: 420 }}>
      <label htmlFor="debounced-search" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
        Debounced search input
      </label>

      <input
        id="debounced-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type quickly..."
        style={{ width: '100%', padding: '8px 10px', marginBottom: 12 }}
      />

      <div style={{ display: 'grid', gap: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        <div>Committed value: {query || '(empty)'}</div>
        <div>Total updates: {stats.totalUpdates}</div>
        <div>Skipped renders: {stats.skippedRenders}</div>
      </div>
    </section>
  );
}
