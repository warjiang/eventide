import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: '教程',
      items: ['tutorial-basics/create-a-document'],
    },
  ],
};

export default sidebars;
