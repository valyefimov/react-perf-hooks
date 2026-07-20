import Link from '@docusaurus/Link';
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
            Explore all hooks with API references, interactive demos, and practical guidance before
            you install.
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

        <section className={styles.gridSection}>
          <Heading as="h2">What this docs site includes</Heading>
          <div className={styles.cardGrid}>
            <article className={styles.card}>
              <h3>16 hook references</h3>
              <p>
                Every hook has signature details, parameter and return tables, and copy-ready usage
                examples.
              </p>
            </article>
            <article className={styles.card}>
              <h3>Interactive demos</h3>
              <p>
                Each hook page links to a StackBlitz workspace so developers can test behavior
                interactively.
              </p>
            </article>
            <article className={styles.card}>
              <h3>Performance guide</h3>
              <p>
                Best-practice checklist linked to companion long-form articles for deeper dives.
              </p>
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
