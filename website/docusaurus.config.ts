import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Eventide',
  tagline: 'Event-driven Agent Task Scheduling System',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://warjiang.github.io',
  baseUrl: '/eventide/',

  organizationName: 'warjiang',
  projectName: 'eventide',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/warjiang/eventide/tree/main/website/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl:
            'https://github.com/warjiang/eventide/tree/main/website/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Eventide',
      logo: {
        alt: 'Eventide Logo',
        src: 'img/logo-v2.jpg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '文档',
        },
        // {to: '/blog', label: '博客', position: 'left'},
        {
          href: 'https://github.com/warjiang/eventide',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '快速开始',
              to: '/docs/getting-started',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/warjiang/eventide',
            },
          ],
        },
        {
          title: '更多',
          items: [
            // {
            //   label: '博客',
            //   to: '/blog',
            // },
            {
              label: 'GitHub',
              href: 'https://github.com/warjiang/eventide',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Eventide. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
