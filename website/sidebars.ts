import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    'event-types',
    'api-reference',
    {
      type: 'category',
      label: 'SDK接入',
      items: [
        'sdk/python-sdk',
        'sdk/go-sdk',
        'sdk/node-sdk',
      ],
    },
    // {
    //   type: 'category',
    //   label: '教程',
    //   items: ['tutorial-basics/create-a-document'],
    // },
  ],
};

export default sidebars;
