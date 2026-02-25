import type { Meta, StoryObj } from '@storybook/react';
import { ComponentRegistry } from './ComponentRegistry';

/**
 * Wrapper component to dynamically render components from ComponentRegistry.
 * This makes it easy to showcase all our AI-generated-compatible components
 * in one Storybook file.
 */
const DynamicComponent = ({ name, props }: { name: string, props: any }) => {
    const Component = ComponentRegistry[name];
    if (!Component) return <div className="p-4 text-red-500">Component "{name}" not found in registry</div>;
    return (
        <div className="p-4 border border-dashed border-gray-300 rounded-lg min-h-[100px] w-[600px] max-w-full">
            <Component props={props} />
        </div>
    );
};

const meta: Meta<typeof DynamicComponent> = {
    title: 'Generative UI/Components',
    component: DynamicComponent,
    tags: ['autodocs'],
    argTypes: {
        name: {
            control: 'select',
            options: Object.keys(ComponentRegistry),
            description: 'The name of the component as it exists in the ComponentRegistry',
        },
        props: {
            control: 'object',
            description: 'The JSON props passed to the component',
        }
    },
};

export default meta;
type Story = StoryObj<typeof DynamicComponent>;

export const DataTableExample: Story = {
    name: 'DataTable',
    args: {
        name: 'DataTable',
        props: {
            columns: ['Name', 'Status', 'Last Active'],
            rows: [
                ['Alice', 'Online', '2 mins ago'],
                ['Bob', 'Offline', '1 hour ago'],
                ['Charlie', 'Online', 'Just now']
            ]
        }
    }
};

export const MetricCardExample: Story = {
    name: 'MetricCard',
    args: {
        name: 'MetricCard',
        props: {
            title: 'Total Revenue',
            value: '$45,231',
            trend: '+20.1% from last month',
            unit: 'USD'
        }
    }
};

export const ChartBarExample: Story = {
    name: 'Chart (Bar)',
    args: {
        name: 'Chart',
        props: {
            type: 'bar',
            xKey: 'name',
            yKey: 'sales',
            height: 250,
            data: [
                { name: 'Jan', sales: 400 },
                { name: 'Feb', sales: 300 },
                { name: 'Mar', sales: 550 },
                { name: 'Apr', sales: 450 }
            ]
        }
    }
};

export const ChartLineExample: Story = {
    name: 'Chart (Line)',
    args: {
        name: 'Chart',
        props: {
            type: 'line',
            xKey: 'name',
            yKey: 'sales',
            height: 250,
            data: [
                { name: 'Jan', sales: 400 },
                { name: 'Feb', sales: 300 },
                { name: 'Mar', sales: 550 },
                { name: 'Apr', sales: 450 }
            ]
        }
    }
};

export const ChartPieExample: Story = {
    name: 'Chart (Pie)',
    args: {
        name: 'Chart',
        props: {
            type: 'pie',
            title: '会员订阅状态',
            height: 300,
            showLegend: true,
            innerRadius: 40,
            colors: ['#1abc9c', '#95a5a6'],
            data: [
                { name: '会员', value: 2730 },
                { name: '非会员', value: 1170 }
            ]
        }
    }
};

export const AlertExampleInfo: Story = {
    name: 'Alert (Info)',
    args: {
        name: 'Alert',
        props: {
            variant: 'info',
            title: 'Did you know?',
            message: 'You can configure these alerts using generative JSON.'
        }
    }
};

export const AlertExampleSuccess: Story = {
    name: 'Alert (Success)',
    args: {
        name: 'Alert',
        props: {
            variant: 'success',
            title: 'Operation Completed',
            message: 'The data pipeline has finished processing successfully.'
        }
    }
};

export const AlertExampleError: Story = {
    name: 'Alert (Error)',
    args: {
        name: 'Alert',
        props: {
            variant: 'error',
            title: 'Operation Failed',
            message: 'Network connection lost during sync.'
        }
    }
};

export const JsonViewerExample: Story = {
    name: 'JsonViewer',
    args: {
        name: 'JsonViewer',
        props: {
            data: {
                user_id: 1024,
                email: "user@example.com",
                preferences: {
                    notifications: true,
                    theme: "dark"
                }
            }
        }
    }
};

export const MarkdownExample: Story = {
    name: 'Markdown',
    args: {
        name: 'Markdown',
        props: {
            content: '### Key Findings\n- User retention increased by **15%**\n- Core feature usage is up\n\nRun the following command to see logs:\n```bash\ntail -f server.log\n```'
        }
    }
};
