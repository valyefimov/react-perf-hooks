import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'getting-started',
    {
      type: 'category',
      label: 'Hooks',
      collapsed: false,
      items: [
        'hooks/use-render-tracker',
        'hooks/use-render-budget',
        'hooks/use-performance-mark',
        'hooks/use-component-lifecycle',
        'hooks/use-memo-profiling',
        'hooks/use-web-vitals',
        'hooks/use-debounced-state',
        'hooks/use-throttled-state',
        'hooks/use-intersection-observer',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: ['guides/performance-checklist'],
    },
  ],
};

export default sidebars;
