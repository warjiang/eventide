import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'
import MarkdownRenderer from './MarkdownRenderer'
import { Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

// Basic DataTable component
function DataTable({ props }: { props: { columns: string[], rows: any[][] } }) {
    const { columns, rows } = props;
    if (!columns || !rows) return null;
    return (
        <div className="rounded-md border border-border overflow-hidden my-2">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            {columns.map((col, i) => (
                                <th key={i} className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                {row.map((cell, j) => (
                                    <td key={j} className="p-4 align-middle">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// MetricCard component
function MetricCard({ props }: { props: { title: string, value: string | number, trend?: string, unit?: string } }) {
    const { title, value, trend, unit } = props;
    const isPositive = trend?.startsWith('+');
    const isNegative = trend?.startsWith('-');

    return (
        <Card className="my-2 bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-baseline gap-1">
                    {value}
                    {unit && <span className="text-sm font-normal text-muted-foreground">{unit}</span>}
                </div>
                {trend && (
                    <p className={`text-xs mt-1 ${isPositive ? 'text-emerald-500' : isNegative ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {trend}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}

// Chart component using recharts
function Chart({ props }: { props: { type?: 'line' | 'bar' | 'pie', data: any[], xKey?: string, yKey?: string, height?: number, title?: string, colors?: string[], showLegend?: boolean, innerRadius?: number } }) {
    const { type = 'line', data, xKey, yKey, height = 200, title, colors, showLegend, innerRadius } = props;
    if (!data || data.length === 0) return null;

    const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#8dd1e1'];
    const pieColors = colors || DEFAULT_COLORS;

    return (
        <Card className="my-2 bg-card overflow-hidden">
            {title && (
                <CardHeader className="pb-0 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                </CardHeader>
            )}
            <div className="p-4" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'pie' ? (
                        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            />
                            {showLegend && <Legend verticalAlign="bottom" height={36} />}
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={innerRadius || 0}
                                outerRadius="80%"
                                fill="hsl(var(--primary))"
                                paddingAngle={2}
                                dataKey={yKey || "value"}
                                nameKey={xKey || "name"}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    ) : type === 'bar' ? (
                        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            {yKey && <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />}
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            />
                            {showLegend && <Legend verticalAlign="bottom" height={36} />}
                            <Bar dataKey={yKey!} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    ) : (
                        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis dataKey={xKey} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                            {yKey && <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />}
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                            />
                            {showLegend && <Legend verticalAlign="bottom" height={36} />}
                            <Line type="monotone" dataKey={yKey!} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </Card>
    )
}

// Custom Alert Component
function CustomAlert({ props }: { props: { variant?: 'info' | 'warn' | 'error' | 'success', message: string, title?: string } }) {
    const { variant = 'info', message, title } = props;
    let icon = <Info className="h-4 w-4" />
    let alertVariant: "default" | "destructive" = "default"
    let colorClass = "text-blue-500 border-blue-500/20 bg-blue-500/10"

    switch (variant) {
        case 'warn':
            icon = <AlertTriangle className="h-4 w-4" />
            colorClass = "text-amber-500 border-amber-500/20 bg-amber-500/10"
            break
        case 'error':
            icon = <XCircle className="h-4 w-4" />
            alertVariant = "destructive"
            colorClass = "" // handled by destructive variant
            break
        case 'success':
            icon = <CheckCircle2 className="h-4 w-4" />
            colorClass = "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
            break
    }

    return (
        <Alert variant={alertVariant} className={`my-2 ${colorClass}`}>
            {icon}
            {title && <AlertTitle>{title}</AlertTitle>}
            <AlertDescription>
                {message}
            </AlertDescription>
        </Alert>
    )
}

// JsonViewer Component (Simplified, just using a styled pre block for now)
function JsonViewer({ props }: { props: { data: any } }) {
    return (
        <div className="font-mono text-xs text-muted-foreground bg-muted/50 p-3 rounded-md overflow-x-auto my-2 border border-border">
            <pre>{JSON.stringify(props.data, null, 2)}</pre>
        </div>
    )
}

// Wrapped Badge instance for json-render
function WrappedBadge({ props }: { props: any }) {
    return <Badge {...props} />;
}

// Register all components to be available for json-render
export const ComponentRegistry: any = {
    DataTable,
    MetricCard,
    Chart,
    Alert: CustomAlert,
    JsonViewer,
    Markdown: ({ props }: { props: { content: string } }) => <MarkdownRenderer content={props.content} />,
    Badge: WrappedBadge,
}
