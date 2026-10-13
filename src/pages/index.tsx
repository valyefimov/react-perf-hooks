import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import type { ReactNode } from 'react';
import styles from './index.module.css';

const hooks = [
  { name: 'useRenderTracker', to: '/docs/hooks/use-render-tracker' },
  { name: 'useAllocationTracker', to: '/docs/hooks/use-allocation-tracker' },
  { name: 'useRenderBudget', to: '/docs/hooks/use-render-budget' },
  { name: 'usePerformanceMark', to: '/docs/hooks/use-performance-mark' },
  { name: 'useComponentLifecycle', to: '/docs/hooks/use-component-lifecycle' },
  { name: 'useMemoProfiling', to: '/docs/hooks/use-memo-profiling' },
  { name: 'useWebVitals', to: '/docs/hooks/use-web-vitals' },
  { name: 'useINP', to: '/docs/hooks/use-inp' },
  { name: 'useCLS', to: '/docs/hooks/use-cls' },
  { name: 'useLongTasks', to: '/docs/hooks/use-long-tasks' },
  { name: 'useFps', to: '/docs/hooks/use-fps' },
  { name: 'useMemoryStatus', to: '/docs/hooks/use-memory-status' },
  { name: 'useNetworkEfficiency', to: '/docs/hooks/use-network-efficiency' },
  { name: 'useDebouncedState', to: '/docs/hooks/use-debounced-state' },
  { name: 'useThrottledState', to: '/docs/hooks/use-throttled-state' },
  { name: 'useIntersectionObserver', to: '/docs/hooks/use-intersection-observer' },
  { name: 'useIdleCallbackWorker', to: '/docs/hooks/use-idle-callback-worker' },
  { name: 'useWhyDidYouUpdate', to: '/docs/hooks/use-why-did-you-update' },
  { name: 'useRenderCount', to: '/docs/hooks/use-render-count' },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="react-perf-hooks documentation"
      description="Interactive documentation for all react-perf-hooks APIs with demos and guides."
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.kicker}>react-perf-hooks</p>
          <Heading as="h1" className={styles.title}>
            Measure React performance without slowing your workflow
          </Heading>
          <p className={styles.subtitle}>
            API references and live demos for every hook, so you can try them before you install.
          </p>
          <div className={styles.ctaRow}>
            <Link className="button button--primary button--lg" to="/docs/getting-started">
              Open Getting Started
            </Link>
            <Link
              className="button button--secondary button--lg"
              to="/docs/hooks/use-render-tracker"
            >
              Browse Hooks
            </Link>
          </div>
          <div className={styles.installCard}>
            <p className={styles.installLabel}>Install</p>
            <pre className={styles.installCode}>
              <code>npm install react-perf-hooks</code>
            </pre>
          </div>
        </section>

        <section className={styles.videoSection}>
          <Heading as="h2">Video walkthrough</Heading>
          <video
            className={styles.video}
            src={useBaseUrl('/video/demo.mp4')}
            poster={useBaseUrl('/video/demo-poster.png')}
            controls
            preload="metadata"
            playsInline
          />
        </section>

        <section className={styles.gridSection}>
          <Heading as="h2">What this docs site includes</Heading>
          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <h3>19 hook references</h3>
              <p>
                Each hook page has the signature, parameter and return tables, and a copy-paste
                example.
              </p>
            </article>
            <article className={styles.card}>
              <h3>Interactive demos</h3>
              <p>Each hook page links to a StackBlitz workspace where you can run it.</p>
            </article>
            <article className={styles.card}>
              <h3>Performance guide</h3>
              <p>A checklist for rolling the hooks out in a real codebase.</p>
            </article>
          </div>
        </section>

        <section className={styles.hookListSection}>
          <Heading as="h2">Hook coverage</Heading>
          <ul className={styles.hookList}>
            {hooks.map((hook) => (
              <li key={hook.name}>
                <Link to={hook.to}>{hook.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </Layout>
  );
}
