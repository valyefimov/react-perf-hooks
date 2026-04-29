import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'react-perf-hooks',
  tagline:
    'Performance-focused React hooks with TypeScript-first APIs and interactive docs',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://valyefimov.github.io',
  baseUrl: '/react-perf-hooks/',

  organizationName: 'valyefimov',
  projectName: 'react-perf-hooks',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/valyefimov/react-perf-hooks/tree/main/website/',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'react-perf-hooks',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          label: 'Docs',
          position: 'left',
        },
        {
          to: '/docs/hooks/use-render-tracker',
          label: 'Hooks',
          position: 'left',
        },
        {
          to: '/docs/guides/performance-checklist',
          label: 'Guides',
          position: 'left',
        },
        {
          href: 'https://github.com/valyefimov/react-perf-hooks',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started',
            },
            {
              label: 'Hooks',
              to: '/docs/hooks/use-render-tracker',
            },
            {
              label: 'Performance Checklist',
              to: '/docs/guides/performance-checklist',
            },
          ],
        },
        {
          title: 'Articles',
          items: [
            {
              label: 'dev.to',
              href: 'https://dev.to/',
            },
            {
              label: 'Medium',
              href: 'https://medium.com/',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'NPM Package',
              href: 'https://www.npmjs.com/package/react-perf-hooks',
            },
            {
              label: 'GitHub Repository',
              href: 'https://github.com/valyefimov/react-perf-hooks',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} react-perf-hooks.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
