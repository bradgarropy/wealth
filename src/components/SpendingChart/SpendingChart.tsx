import {useState} from "react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    XAxis,
    YAxis,
} from "recharts"

import {
    ChartRangePicker,
    type HistoryWindow,
} from "~/components/ChartRangePicker"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import {defaultWindows} from "~/db/schema"
import type {SpendingTrendPoint} from "~/utils/finance"
import {
    formatChartDate,
    formatCompactMoney,
    formatDate,
    formatMoney,
} from "~/utils/format"

const chartConfig = {
    allTimeAverageCents: {
        color: "var(--foreground)",
        label: "All-time average",
    },
    spendingCents: {
        color: "var(--chart-1)",
        label: "Weekly spending",
    },
} satisfies ChartConfig

type SpendingChartProps = {
    defaultWindow: number
    points: SpendingTrendPoint[]
}

const renderSpendingTooltip = () => {
    return (
        <ChartTooltip
            content={
                <ChartTooltipContent
                    formatter={(value, name) => (
                        <>
                            <span className="text-muted-foreground">
                                {chartConfig[name as keyof typeof chartConfig]
                                    ?.label ?? name}
                            </span>
                            <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                                {formatMoney(Number(value))}
                            </span>
                        </>
                    )}
                    labelFormatter={(_, payload) => {
                        const date = payload[0]?.payload?.date

                        return typeof date === "string" ? formatDate(date) : ""
                    }}
                />
            }
        />
    )
}

const SpendingChart = ({defaultWindow, points}: SpendingChartProps) => {
    const initialWindow =
        defaultWindows.find(window => window === defaultWindow) ?? 52
    const [window, setWindow] = useState<HistoryWindow>(initialWindow)
    const visiblePoints = window === "all" ? points : points.slice(-window)

    return (
        <>
            <div className="mb-6">
                <ChartRangePicker value={window} onValueChange={setWindow} />
            </div>

            <div className="space-y-12">
                <section aria-labelledby="weekly-spending-heading">
                    <h3
                        className="mb-4 text-sm font-medium"
                        id="weekly-spending-heading"
                    >
                        Weekly spending
                    </h3>
                    <ChartContainer
                        aria-label="Weekly spending over time"
                        className="h-64 min-w-0 w-full sm:h-80"
                        config={chartConfig}
                        role="img"
                    >
                        <BarChart
                            accessibilityLayer
                            data={visiblePoints}
                            margin={{left: 8, right: 8, top: 8}}
                            style={{cursor: "auto"}}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                axisLine={false}
                                dataKey="date"
                                minTickGap={32}
                                tickFormatter={formatChartDate}
                                tickLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickFormatter={formatCompactMoney}
                                tickLine={false}
                                tickMargin={8}
                                width={52}
                            />
                            {renderSpendingTooltip()}
                            <Bar
                                dataKey="spendingCents"
                                fill="var(--color-spendingCents)"
                                maxBarSize={24}
                                radius={[3, 3, 0, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                </section>

                <section aria-labelledby="spending-average-heading">
                    <h3
                        className="mb-4 text-sm font-medium"
                        id="spending-average-heading"
                    >
                        All-time average
                    </h3>
                    <ChartContainer
                        aria-label="All-time spending average over time"
                        className="h-64 min-w-0 w-full sm:h-80"
                        config={chartConfig}
                        role="img"
                    >
                        <LineChart
                            accessibilityLayer
                            data={visiblePoints}
                            margin={{left: 8, right: 8, top: 8}}
                            style={{cursor: "auto"}}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                axisLine={false}
                                dataKey="date"
                                minTickGap={32}
                                tickFormatter={formatChartDate}
                                tickLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                axisLine={false}
                                domain={["auto", "auto"]}
                                tickFormatter={formatCompactMoney}
                                tickLine={false}
                                tickMargin={8}
                                width={52}
                            />
                            {renderSpendingTooltip()}
                            <Line
                                dataKey="allTimeAverageCents"
                                dot={false}
                                stroke="var(--color-allTimeAverageCents)"
                                strokeWidth={2.5}
                                type="linear"
                            />
                        </LineChart>
                    </ChartContainer>
                </section>
            </div>
        </>
    )
}

export {SpendingChart}
