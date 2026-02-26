import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart as ELineChart, BarChart as EBarChart, PieChart as EPieChart } from 'echarts/charts'
import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import MarkdownRenderer from './MarkdownRenderer'
import {
    Info, AlertTriangle, XCircle, CheckCircle2,
    BarChart3, Table, TrendingUp, Bell, FileJson, FileText, Component,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Register ECharts components (tree-shakable)
echarts.use([
    ELineChart, EBarChart, EPieChart,
    GridComponent, TooltipComponent, LegendComponent, TitleComponent,
    CanvasRenderer,
])

// ── Icon mapping for each registered component ──────────────────────────
export const componentIcons: Record<string, LucideIcon> = {
    Chart: BarChart3,
    DataTable: Table,
    MetricCard: TrendingUp,
    Alert: Bell,
    JsonViewer: FileJson,
    Markdown: FileText,
    Badge: Component,
}

// ── Basic DataTable component ───────────────────────────────────────────
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

// ── MetricCard component ────────────────────────────────────────────────
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

// ── Premium color palettes ──────────────────────────────────────────────
const GRADIENT_COLORS = [
    { start: '#667eea', end: '#764ba2' },
    { start: '#f093fb', end: '#f5576c' },
    { start: '#4facfe', end: '#00f2fe' },
    { start: '#43e97b', end: '#38f9d7' },
    { start: '#fa709a', end: '#fee140' },
    { start: '#a18cd1', end: '#fbc2eb' },
]

const SOLID_COLORS = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#a18cd1']

// ── ECharts Chart component ─────────────────────────────────────────────
function Chart({ props }: { props: { type?: 'line' | 'bar' | 'pie', data: any[], xKey?: string, yKey?: string, height?: number, title?: string, colors?: string[], showLegend?: boolean, innerRadius?: number } }) {
    const { type = 'line', data, xKey, yKey, height = 280, title, colors, showLegend, innerRadius } = props;
    if (!data || data.length === 0) return null;

    const chartColors = colors || SOLID_COLORS;

    // CSS variable → computed color (for theming)
    const getCssVar = (name: string) => {
        if (typeof document === 'undefined') return '#888'
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'
    }

    const textColor = getCssVar('--muted-foreground') || '#94a3b8'
    const borderColor = getCssVar('--border') || '#334155'

    const buildOption = (): any => {
        const baseTooltip = {
            trigger: type === 'pie' ? 'item' : 'axis',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: 'rgba(148, 163, 184, 0.2)',
            borderRadius: 12,
            padding: [10, 14],
            textStyle: {
                color: '#e2e8f0',
                fontSize: 12,
            },
            extraCssText: 'box-shadow: 0 8px 32px rgba(0,0,0,0.3); backdrop-filter: blur(10px);',
        }

        if (type === 'pie') {
            return {
                tooltip: baseTooltip,
                legend: showLegend ? {
                    bottom: 0,
                    textStyle: { color: textColor, fontSize: 11 },
                    itemWidth: 10, itemHeight: 10,
                    itemGap: 16,
                } : undefined,
                animationDuration: 800,
                animationEasing: 'cubicInOut',
                series: [{
                    type: 'pie',
                    radius: [innerRadius ? `${innerRadius}%` : '0%', '75%'],
                    center: ['50%', showLegend ? '45%' : '50%'],
                    avoidLabelOverlap: true,
                    padAngle: 2,
                    itemStyle: {
                        borderRadius: 6,
                        borderColor: 'transparent',
                        borderWidth: 2,
                    },
                    label: {
                        show: true,
                        formatter: '{b}: {d}%',
                        color: textColor,
                        fontSize: 11,
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 20,
                            shadowOffsetX: 0,
                            shadowColor: 'rgba(0, 0, 0, 0.3)',
                        },
                        label: { fontSize: 13, fontWeight: 'bold' },
                    },
                    data: data.map((d, i) => ({
                        value: d[yKey || 'value'],
                        name: d[xKey || 'name'],
                        itemStyle: { color: chartColors[i % chartColors.length] },
                    })),
                }],
            }
        }

        // Line or Bar
        const xData = data.map(d => d[xKey || 'name'])
        const yData = data.map(d => d[yKey || 'value'])
        const primaryColor = chartColors[0] || '#667eea'
        const gradientPair = GRADIENT_COLORS[0]

        const series: any = type === 'bar' ? {
            type: 'bar',
            data: yData,
            barWidth: '50%',
            barMaxWidth: 40,
            itemStyle: {
                borderRadius: [6, 6, 0, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: gradientPair.start },
                    { offset: 1, color: gradientPair.end },
                ]),
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 12,
                    shadowColor: 'rgba(102, 126, 234, 0.4)',
                },
            },
        } : {
            type: 'line',
            data: yData,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
                width: 3,
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: gradientPair.start },
                    { offset: 1, color: gradientPair.end },
                ]),
                shadowColor: 'rgba(102, 126, 234, 0.3)',
                shadowBlur: 10,
                shadowOffsetY: 6,
            },
            itemStyle: { color: primaryColor, borderWidth: 2, borderColor: '#fff' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: `${primaryColor}40` },
                    { offset: 0.7, color: `${primaryColor}08` },
                    { offset: 1, color: 'transparent' },
                ]),
            },
        }

        return {
            tooltip: baseTooltip,
            legend: showLegend ? {
                bottom: 0,
                textStyle: { color: textColor, fontSize: 11 },
                itemWidth: 10, itemHeight: 10,
            } : undefined,
            grid: {
                left: 12, right: 16, top: 16,
                bottom: showLegend ? 40 : 12,
                containLabel: true,
            },
            xAxis: {
                type: 'category',
                data: xData,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: textColor, fontSize: 11 },
                splitLine: { show: false },
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: textColor, fontSize: 11 },
                splitLine: {
                    lineStyle: { color: borderColor, type: 'dashed', opacity: 0.3 },
                },
            },
            animationDuration: 800,
            animationEasing: 'cubicInOut',
            series: [series],
        }
    }

    return (
        <Card className="my-2 bg-card overflow-hidden">
            {title && (
                <CardHeader className="pb-0 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                </CardHeader>
            )}
            <div className="p-4">
                <ReactEChartsCore
                    echarts={echarts}
                    option={buildOption()}
                    style={{ height: height, width: '100%' }}
                    opts={{ renderer: 'canvas' }}
                    notMerge={true}
                    lazyUpdate={true}
                />
            </div>
        </Card>
    )
}

// ── Custom Alert Component ──────────────────────────────────────────────
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

// ── JsonViewer Component ────────────────────────────────────────────────
function JsonViewer({ props }: { props: { data: any } }) {
    return (
        <div className="font-mono text-xs text-muted-foreground bg-muted/50 p-3 rounded-md overflow-x-auto my-2 border border-border">
            <pre>{JSON.stringify(props.data, null, 2)}</pre>
        </div>
    )
}

// ── Wrapped Badge  ──────────────────────────────────────────────────────
function WrappedBadge({ props }: { props: any }) {
    return <Badge {...props} />;
}

// ── Component Registry ──────────────────────────────────────────────────
export const ComponentRegistry: any = {
    DataTable,
    MetricCard,
    Chart,
    Alert: CustomAlert,
    JsonViewer,
    Markdown: ({ props }: { props: { content: string } }) => <MarkdownRenderer content={props.content} />,
    Badge: WrappedBadge,
}
