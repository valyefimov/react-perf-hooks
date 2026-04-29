import {useMemo, useState} from 'react';
import {UseComponentLifecycleDemo} from './demos/useComponentLifecycleDemo';
import {UseDebouncedStateDemo} from './demos/useDebouncedStateDemo';
import {UseIntersectionObserverDemo} from './demos/useIntersectionObserverDemo';
import {UseMemoProfilingDemo} from './demos/useMemoProfilingDemo';
import {UsePerformanceMarkDemo} from './demos/usePerformanceMarkDemo';
import {UseRenderBudgetDemo} from './demos/useRenderBudgetDemo';
import {UseRenderTrackerDemo} from './demos/useRenderTrackerDemo';
import {UseThrottledStateDemo} from './demos/useThrottledStateDemo';
import {UseWebVitalsDemo} from './demos/useWebVitalsDemo';

type DemoKey =
  | 'useRenderTracker'
  | 'useRenderBudget'
  | 'usePerformanceMark'
  | 'useComponentLifecycle'
  | 'useMemoProfiling'
  | 'useWebVitals'
  | 'useDebouncedState'
  | 'useThrottledState'
  | 'useIntersectionObserver';

const demos: Record<DemoKey, {label: string; Component: () => JSX.Element}> = {
  useRenderTracker: {label: 'useRenderTracker', Component: UseRenderTrackerDemo},
  useRenderBudget: {label: 'useRenderBudget', Component: UseRenderBudgetDemo},
  usePerformanceMark: {label: 'usePerformanceMark', Component: UsePerformanceMarkDemo},
  useComponentLifecycle: {label: 'useComponentLifecycle', Component: UseComponentLifecycleDemo},
  useMemoProfiling: {label: 'useMemoProfiling', Component: UseMemoProfilingDemo},
  useWebVitals: {label: 'useWebVitals', Component: UseWebVitalsDemo},
  useDebouncedState: {label: 'useDebouncedState', Component: UseDebouncedStateDemo},
  useThrottledState: {label: 'useThrottledState', Component: UseThrottledStateDemo},
  useIntersectionObserver: {label: 'useIntersectionObserver', Component: UseIntersectionObserverDemo},
};

const fallback: DemoKey = 'useComponentLifecycle';

function readDemoFromUrl(): DemoKey {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  if (demo && demo in demos) {
    return demo as DemoKey;
  }
  return fallback;
}

export function App() {
  const [activeDemo, setActiveDemo] = useState<DemoKey>(readDemoFromUrl);
  const ActiveComponent = useMemo(() => demos[activeDemo].Component, [activeDemo]);

  const onSelectDemo = (nextDemo: DemoKey) => {
    setActiveDemo(nextDemo);
    const url = new URL(window.location.href);
    url.searchParams.set('demo', nextDemo);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <main style={{fontFamily: 'system-ui', maxWidth: 920, margin: '24px auto', padding: '0 12px'}}>
      <h1 style={{margin: 0}}>react-perf-hooks interactive demos</h1>
      <p style={{color: '#334155'}}>Choose a hook demo and interact with the rendered component.</p>

      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
        {(Object.keys(demos) as DemoKey[]).map((demoKey) => (
          <button
            key={demoKey}
            type="button"
            onClick={() => onSelectDemo(demoKey)}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              background: demoKey === activeDemo ? '#0f172a' : '#ffffff',
              color: demoKey === activeDemo ? '#ffffff' : '#0f172a',
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            {demos[demoKey].label}
          </button>
        ))}
      </div>

      <section>
        <ActiveComponent />
      </section>
    </main>
  );
}
