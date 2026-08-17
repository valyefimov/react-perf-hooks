import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'getting-started',
    {
      type: 'category',
      label: 'Hooks',
      collapsed: false,
      items: [
        'hooks/use-render-tracker',
        'hooks/use-allocation-tracker',
        'hooks/use-render-budget',
        'hooks/use-performance-mark',
        'hooks/use-component-lifecycle',
        'hooks/use-memo-profiling',
        'hooks/use-web-vitals',
        'hooks/use-inp',
        'hooks/use-cls',
        'hooks/use-long-tasks',
        'hooks/use-fps',
        'hooks/use-memory-status',
        'hooks/use-network-efficiency',
        'hooks/use-debounced-state',
        'hooks/use-throttled-state',
        'hooks/use-intersection-observer',
        'hooks/use-idle-callback-worker',
        'hooks/use-why-did-you-update',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/performance-checklist', 'guides/perf-provider'],
    },
  ],
};

export default sidebars;
