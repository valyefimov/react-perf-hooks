import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const hooks = [
  'useRenderTracker',
  'useRenderBudget',
  'usePerformanceMark',
  'useComponentLifecycle',
  'useMemoProfiling',
  'useWebVitals',
  'useDebouncedState',
  'useThrottledState',
  'useIntersectionObserver',
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="react-perf-hooks documentation"
      description="Interactive documentation for all react-perf-hooks APIs with demos and guides.">
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.kicker}>react-perf-hooks</p>
          <Heading as="h1" className={styles.title}>
            Measure React performance without slowing your workflow
          </Heading>
          <p className={styles.subtitle}>
            Explore all hooks with API references, live demo embeds, and practical guidance before you install.
          </p>
          <div className={styles.ctaRow}>
            <Link className="button button--primary button--lg" to="/docs/getting-started">
              Open Getting Started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/hooks/use-render-tracker">
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
              <h3>9 hook references</h3>
              <p>Every hook has signature details, parameter and return tables, and copy-ready usage examples.</p>
            </article>
            <article className={styles.card}>
              <h3>Live demo embeds</h3>
              <p>Each hook page includes a StackBlitz embed so developers can test behavior interactively.</p>
            </article>
            <article className={styles.card}>
              <h3>Performance guide</h3>
              <p>Best-practice checklist linked to companion long-form articles for deeper dives.</p>
            </article>
          </div>
        </section>

        <section className={styles.hookListSection}>
          <Heading as="h2">Hook coverage</Heading>
          <ul className={styles.hookList}>
            {hooks.map((hookName) => (
              <li key={hookName}>{hookName}</li>
            ))}
          </ul>
        </section>
      </main>
    </Layout>
  );
}
