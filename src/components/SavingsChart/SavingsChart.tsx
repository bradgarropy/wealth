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
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import {defaultWindows} from "~/db/schema"
import type {CaptureSummary, SavingsRateTrendPoint} from "~/utils/finance"
import {
    formatChartDate,
    formatCompactMoney,
    formatDate,
    formatMoney,
    formatPercentage,
} from "~/utils/format"

const allocationChartConfig = {
    totalSavedCents: {
        color: "var(--financial-savings)",
        label: "Weekly savings",
    },
} satisfies ChartConfig

const rateTrendChartConfig = {
    allTimeRate: {
        color: "var(--foreground)",
        label: "All-time rate",
        legendStyle: "dashed",
    },
    fiftyTwoWeekRate: {
        color: "var(--foreground)",
        label: "52-week rate",
        legendStyle: "solid",
    },
    twelveWeekRate: {
        color: "var(--financial-savings)",
        label: "12-week rate",
        legendStyle: "solid",
    },
} satisfies ChartConfig

export type SavingsPoint = Pick<
    CaptureSummary,
    "investmentsSavedCents" | "savingsSavedCents" | "totalSavedCents"
> & {
    date: string
}

type SavingsChartProps = {
    defaultWindow: number
    points: SavingsPoint[]
    ratePoints: SavingsRateTrendPoint[]
}

const SavingsChart = ({
    defaultWindow,
    points,
    ratePoints,
}: SavingsChartProps) => {
    const initialWindow =
        defaultWindows.find(window => window === defaultWindow) ?? 52
    const [window, setWindow] = useState<HistoryWindow>(initialWindow)
    const visiblePoints = window === "all" ? points : points.slice(-window)
    const visibleRatePoints =
        window === "all" ? ratePoints : ratePoints.slice(-window)

    return (
        <>
            <div className="mb-4">
                <ChartRangePicker value={window} onValueChange={setWindow} />
            </div>

            <div className="space-y-12">
                <section aria-labelledby="savings-allocations-heading">
                    <h3
                        className="mb-4 text-sm font-medium"
                        id="savings-allocations-heading"
                    >
                        Weekly savings
                    </h3>
                    <ChartContainer
                        aria-label="Weekly savings over time"
                        className="h-64 min-w-0 w-full sm:h-80"
                        config={allocationChartConfig}
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
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value, _name, item) => {
                                            const point = item.payload as
                                                | SavingsPoint
                                                | undefined

                                            return (
                                                <div className="grid w-full min-w-40 gap-1.5">
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            Total saved
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatMoney(
                                                                Number(value),
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            Investments
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatMoney(
                                                                point?.investmentsSavedCents ??
                                                                    0,
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <span className="text-muted-foreground">
                                                            Savings
                                                        </span>
                                                        <span className="font-mono font-medium text-foreground tabular-nums">
                                                            {formatMoney(
                                                                point?.savingsSavedCents ??
                                                                    0,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        }}
                                        labelFormatter={(_, payload) => {
                                            const date =
                                                payload[0]?.payload?.date

                                            return typeof date === "string"
                                                ? formatDate(date)
                                                : ""
                                        }}
                                    />
                                }
                            />
                            <Bar
                                dataKey="totalSavedCents"
                                fill="var(--color-totalSavedCents)"
                                maxBarSize={24}
                                radius={[3, 3, 0, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                </section>

                {visibleRatePoints.length > 0 && (
                    <section aria-labelledby="savings-rate-comparison-heading">
                        <h3
                            className="mb-4 text-sm font-medium"
                            id="savings-rate-comparison-heading"
                        >
                            Recent savings trends
                        </h3>
                        <ChartContainer
                            aria-label="Twelve-week, fifty-two-week, and all-time savings rates over time"
                            className="h-64 min-w-0 w-full sm:h-80"
                            config={rateTrendChartConfig}
                            role="img"
                        >
                            <LineChart
                                accessibilityLayer
                                data={visibleRatePoints}
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
                                    domain={[0, 1]}
                                    tickFormatter={formatPercentage}
                                    tickLine={false}
                                    tickMargin={8}
                                    width={52}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            formatter={(value, name) => (
                                                <>
                                                    <span className="text-muted-foreground">
                                                        {rateTrendChartConfig[
                                                            name as keyof typeof rateTrendChartConfig
                                                        ]?.label ?? name}
                                                    </span>
                                                    <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                                                        {formatPercentage(
                                                            Number(value),
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                            labelFormatter={(_, payload) => {
                                                const date =
                                                    payload[0]?.payload?.date

                                                return typeof date === "string"
                                                    ? formatDate(date)
                                                    : ""
                                            }}
                                        />
                                    }
                                />
                                <ChartLegend
                                    content={<ChartLegendContent />}
                                    verticalAlign="top"
                                />
                                <Line
                                    dataKey="twelveWeekRate"
                                    dot={false}
                                    stroke="var(--color-twelveWeekRate)"
                                    strokeWidth={2.5}
                                    type="linear"
                                />
                                <Line
                                    dataKey="fiftyTwoWeekRate"
                                    dot={false}
                                    stroke="var(--color-fiftyTwoWeekRate)"
                                    strokeWidth={2.5}
                                    type="linear"
                                />
                                <Line
                                    dataKey="allTimeRate"
                                    dot={false}
                                    stroke="var(--color-allTimeRate)"
                                    strokeDasharray="5 5"
                                    strokeOpacity={0.55}
                                    strokeWidth={2}
                                    type="linear"
                                />
                            </LineChart>
                        </ChartContainer>
                    </section>
                )}
            </div>
        </>
    )
}

export {SavingsChart}
