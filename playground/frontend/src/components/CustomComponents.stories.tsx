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
            title: 'Monthly Sales Performance',
            xKey: 'name',
            yKey: 'sales',
            height: 300,
            data: [
                { name: 'Jan', sales: 4200 },
                { name: 'Feb', sales: 3800 },
                { name: 'Mar', sales: 5500 },
                { name: 'Apr', sales: 4900 },
                { name: 'May', sales: 6200 },
                { name: 'Jun', sales: 5800 }
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
            title: 'User Growth Trend',
            xKey: 'month',
            yKey: 'users',
            height: 300,
            data: [
                { month: 'Jan', users: 1200 },
                { month: 'Feb', users: 1900 },
                { month: 'Mar', users: 2400 },
                { month: 'Apr', users: 3100 },
                { month: 'May', users: 4200 },
                { month: 'Jun', users: 5800 },
                { month: 'Jul', users: 6500 },
                { month: 'Aug', users: 7200 }
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
            height: 340,
            showLegend: true,
            innerRadius: 40,
            colors: ['#667eea', '#f5576c', '#4facfe', '#43e97b'],
            data: [
                { name: '年度会员', value: 2730 },
                { name: '月度会员', value: 1170 },
                { name: '试用用户', value: 850 },
                { name: '免费用户', value: 420 }
            ]
        }
    }
};

export const ChartDonutExample: Story = {
    name: 'Chart (Donut)',
    args: {
        name: 'Chart',
        props: {
            type: 'pie',
            title: 'Traffic Sources',
            height: 320,
            showLegend: true,
            innerRadius: 55,
            colors: ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a'],
            data: [
                { name: 'Organic Search', value: 42 },
                { name: 'Direct', value: 28 },
                { name: 'Social Media', value: 18 },
                { name: 'Referral', value: 8 },
                { name: 'Other', value: 4 }
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
