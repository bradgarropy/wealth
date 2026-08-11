import {useMemo, useState} from "react"
import {CartesianGrid, Line, LineChart, XAxis, YAxis} from "recharts"

import MoneyInput from "~/components/MoneyInput"
import NumberInput from "~/components/NumberInput"
import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import type {FinanceSnapshot} from "~/utils/finance"
import {
    formatCompactMoney,
    formatDate,
    formatMoney,
    formatPercentage,
} from "~/utils/format"

const millisecondsPerYear = 365.2425 * 24 * 60 * 60 * 1000

const chartConfig = {
    actualAssetsCents: {
        color: "var(--muted-foreground)",
        label: "Actual assets",
        legendStyle: "solid",
    },
    expectedAssetsCents: {
        color: "var(--foreground)",
        label: "Expected",
        legendStyle: "dashed",
    },
    highAssetsCents: {
        color: "var(--financial-positive)",
        label: "High",
        legendStyle: "dashed",
    },
    lowAssetsCents: {
        color: "var(--financial-negative)",
        label: "Low",
        legendStyle: "dashed",
    },
    historicalPaceAssetsCents: {
        color: "var(--chart-2)",
        label: "Current pace",
        legendStyle: "solid",
    },
} satisfies ChartConfig

type ProjectionPoint = {
    actualAssetsCents?: number
    date: string
    expectedAssetsCents?: number
    highAssetsCents?: number
    historicalPaceAssetsCents?: number
    lowAssetsCents?: number
    timestamp: number
}

type AssetsProjectionChartProps = {
    snapshots: FinanceSnapshot[]
}

const getTimestamp = (date: string) =>
    new Date(`${date}T00:00:00.000Z`).getTime()

const getYearsToTarget = (
    currentCents: number,
    targetCents: number,
    annualGrowthPercent: number,
) => {
    if (currentCents >= targetCents) {
        return 0
    }

    if (currentCents <= 0 || annualGrowthPercent <= 0) {
        return null
    }

    return (
        Math.log(targetCents / currentCents) /
        Math.log(1 + annualGrowthPercent / 100)
    )
}

const getTargetYear = (latestDate: string, years: number | null) => {
    if (years === null) {
        return null
    }

    return new Date(
        getTimestamp(latestDate) + years * millisecondsPerYear,
    ).getUTCFullYear()
}

const getTrailingAssetIncrease = (snapshots: FinanceSnapshot[]) => {
    const latest = snapshots.at(-1)

    if (!latest || latest.assetsCents <= 0) {
        return null
    }

    const latestTimestamp = getTimestamp(latest.date)
    const comparisonTimestamp = latestTimestamp - millisecondsPerYear
    const comparison = snapshots
        .slice(0, -1)
        .filter(snapshot => snapshot.assetsCents > 0)
        .toSorted(
            (left, right) =>
                Math.abs(getTimestamp(left.date) - comparisonTimestamp) -
                Math.abs(getTimestamp(right.date) - comparisonTimestamp),
        )
        .at(0)

    if (!comparison) {
        return null
    }

    const elapsedYears =
        (latestTimestamp - getTimestamp(comparison.date)) / millisecondsPerYear

    if (elapsedYears < 0.875 || elapsedYears > 1.125) {
        return null
    }

    return Math.round(
        (latest.assetsCents - comparison.assetsCents) / elapsedYears,
    )
}

const getYearsToTargetAtPace = (
    currentCents: number,
    targetCents: number,
    annualIncreaseCents: number,
) => {
    if (currentCents >= targetCents) {
        return 0
    }

    if (annualIncreaseCents <= 0) {
        return null
    }

    return (targetCents - currentCents) / annualIncreaseCents
}

const buildProjection = (
    snapshots: FinanceSnapshot[],
    targetCents: number,
    expectedGrowth: number,
    range: number,
    historicalAnnualIncreaseCents: number | null,
) => {
    const latest = snapshots.at(-1)

    if (!latest) {
        return []
    }

    const lowGrowth = Math.max(expectedGrowth - range, 0)
    const highGrowth = expectedGrowth + range
    const scenarioYears = [lowGrowth, expectedGrowth, highGrowth]
        .map(growth =>
            getYearsToTarget(latest.assetsCents, targetCents, growth),
        )
        .filter(years => years !== null)
    const projectionYears = Math.min(
        Math.max(10, Math.ceil(Math.max(...scenarioYears, 30))),
        100,
    )
    const projectionMonths = projectionYears * 12
    const latestTimestamp = getTimestamp(latest.date)
    const historicalPoints: ProjectionPoint[] = snapshots.map(snapshot => ({
        actualAssetsCents: snapshot.assetsCents,
        date: snapshot.date,
        timestamp: getTimestamp(snapshot.date),
    }))
    const futurePoints: ProjectionPoint[] = Array.from(
        {length: projectionMonths + 1},
        (_, month) => {
            const years = month / 12
            const timestamp = latestTimestamp + years * millisecondsPerYear
            const date = new Date(timestamp).toISOString().slice(0, 10)
            const project = (growth: number) => {
                const projectedCents = Math.round(
                    latest.assetsCents * Math.pow(1 + growth / 100, years),
                )
                const targetYears = getYearsToTarget(
                    latest.assetsCents,
                    targetCents,
                    growth,
                )

                if (targetYears !== null && years > targetYears + 1 / 12) {
                    return undefined
                }

                return Math.min(projectedCents, targetCents)
            }
            const projectHistoricalPace = () => {
                if (historicalAnnualIncreaseCents === null) {
                    return undefined
                }

                const targetYears = getYearsToTargetAtPace(
                    latest.assetsCents,
                    targetCents,
                    historicalAnnualIncreaseCents,
                )

                if (targetYears !== null && years > targetYears + 1 / 12) {
                    return undefined
                }

                return Math.min(
                    Math.max(
                        Math.round(
                            latest.assetsCents +
                                historicalAnnualIncreaseCents * years,
                        ),
                        0,
                    ),
                    targetCents,
                )
            }

            return {
                date,
                expectedAssetsCents: project(expectedGrowth),
                highAssetsCents: project(highGrowth),
                historicalPaceAssetsCents: projectHistoricalPace(),
                lowAssetsCents: project(lowGrowth),
                timestamp,
            }
        },
    )

    return [
        ...historicalPoints.slice(0, -1),
        {...historicalPoints.at(-1), ...futurePoints[0]},
        ...futurePoints.slice(1),
    ]
}

const AssetsProjectionChart = ({snapshots}: AssetsProjectionChartProps) => {
    const [targetDollars, setTargetDollars] = useState(5_000_000)
    const [withdrawalRate, setWithdrawalRate] = useState(4)
    const [expectedGrowth, setExpectedGrowth] = useState(8)
    const [range, setRange] = useState(3)
    const latest = snapshots.at(-1)
    const historicalAnnualIncreaseCents = getTrailingAssetIncrease(snapshots)
    const targetCents = Math.round(targetDollars * 100)
    const annualWithdrawalCents = Math.round(
        targetCents * (withdrawalRate / 100),
    )
    const historicalTargetYear = latest
        ? getTargetYear(
              latest.date,
              historicalAnnualIncreaseCents === null
                  ? null
                  : getYearsToTargetAtPace(
                        latest.assetsCents,
                        targetCents,
                        historicalAnnualIncreaseCents,
                    ),
          )
        : null
    const points = useMemo(
        () =>
            buildProjection(
                snapshots,
                targetCents,
                expectedGrowth,
                range,
                historicalAnnualIncreaseCents,
            ),
        [
            expectedGrowth,
            historicalAnnualIncreaseCents,
            range,
            snapshots,
            targetCents,
        ],
    )
    const progress = latest ? Math.min(latest.assetsCents / targetCents, 1) : 0

    if (!latest) {
        return null
    }

    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2" htmlFor="projection-target">
                    <span className="text-sm font-medium">Target assets</span>
                    <MoneyInput
                        ariaLabel="Target assets"
                        id="projection-target"
                        value={targetDollars}
                        onValueChange={value =>
                            value !== null && value > 0
                                ? setTargetDollars(value)
                                : undefined
                        }
                    />
                </label>
                <label
                    className="space-y-2"
                    htmlFor="projection-withdrawal-rate"
                >
                    <span className="text-sm font-medium">Withdrawal rate</span>
                    <NumberInput
                        addon="%"
                        addonAlign="inline-end"
                        ariaLabel="Withdrawal rate"
                        format={{maximumFractionDigits: 1}}
                        id="projection-withdrawal-rate"
                        max={20}
                        min={0}
                        step={0.5}
                        value={withdrawalRate}
                        onValueChange={value =>
                            value !== null
                                ? setWithdrawalRate(value)
                                : undefined
                        }
                    />
                </label>
                <label className="space-y-2" htmlFor="projection-growth">
                    <span className="text-sm font-medium">
                        Expected yearly growth
                    </span>
                    <NumberInput
                        addon="%"
                        addonAlign="inline-end"
                        ariaLabel="Expected yearly growth"
                        format={{maximumFractionDigits: 1}}
                        id="projection-growth"
                        max={50}
                        min={0}
                        step={0.5}
                        value={expectedGrowth}
                        onValueChange={value =>
                            value !== null
                                ? setExpectedGrowth(value)
                                : undefined
                        }
                    />
                </label>
                <label className="space-y-2" htmlFor="projection-range">
                    <span className="text-sm font-medium">Scenario range</span>
                    <NumberInput
                        addon="%"
                        addonAlign="inline-end"
                        ariaLabel="Scenario range"
                        format={{maximumFractionDigits: 1}}
                        id="projection-range"
                        max={20}
                        min={0}
                        step={0.5}
                        value={range}
                        onValueChange={value =>
                            value !== null ? setRange(value) : undefined
                        }
                    />
                </label>
            </div>

            <div className="grid grid-cols-2 border-y sm:grid-cols-4 sm:divide-x">
                <div className="py-5 pr-3 sm:px-5 sm:first:pl-0">
                    <p className="text-sm text-muted-foreground">
                        Current assets
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatMoney(latest.assetsCents)}
                    </p>
                </div>
                <div className="border-l py-5 pl-3 sm:border-l-0 sm:px-5">
                    <p className="text-sm text-muted-foreground">Funded</p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatPercentage(progress)}
                    </p>
                </div>
                <div className="border-t py-5 pr-3 sm:border-t-0 sm:px-5">
                    <p className="text-sm text-muted-foreground">
                        Yearly withdrawal
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                        {formatMoney(annualWithdrawalCents)}
                    </p>
                </div>
                <div className="border-t border-l py-5 pl-3 sm:border-t-0 sm:border-l-0 sm:px-5 sm:last:pr-0">
                    <p className="text-sm text-muted-foreground">
                        Current pace target date
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">
                        {historicalTargetYear ?? "Not reached"}
                    </p>
                </div>
            </div>

            <ChartContainer
                aria-label="Historical and projected assets"
                className="h-72 min-w-0 w-full sm:h-96"
                config={chartConfig}
                role="img"
            >
                <LineChart
                    accessibilityLayer
                    data={points}
                    margin={{left: 8, right: 8, top: 24}}
                    style={{cursor: "auto"}}
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        axisLine={false}
                        dataKey="timestamp"
                        domain={["dataMin", "dataMax"]}
                        minTickGap={48}
                        scale="time"
                        tickFormatter={timestamp =>
                            new Date(Number(timestamp))
                                .getUTCFullYear()
                                .toString()
                        }
                        tickLine={false}
                        tickMargin={10}
                        type="number"
                    />
                    <YAxis
                        axisLine={false}
                        domain={[0, targetCents]}
                        tickFormatter={formatCompactMoney}
                        tickLine={false}
                        tickMargin={8}
                        ticks={[
                            0,
                            targetCents * 0.25,
                            targetCents * 0.5,
                            targetCents * 0.75,
                            targetCents,
                        ]}
                        width={52}
                    />
                    <ChartTooltip
                        content={
                            <ChartTooltipContent
                                formatter={(value, name) => (
                                    <>
                                        <span className="text-muted-foreground">
                                            {chartConfig[
                                                name as keyof typeof chartConfig
                                            ]?.label ?? name}
                                        </span>
                                        <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                                            {formatMoney(Number(value))}
                                        </span>
                                    </>
                                )}
                                labelFormatter={(_, payload) => {
                                    const date = payload[0]?.payload?.date

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
                        connectNulls={false}
                        dataKey="actualAssetsCents"
                        dot={false}
                        isAnimationActive={false}
                        stroke="var(--color-actualAssetsCents)"
                        strokeWidth={2.5}
                        type="linear"
                    />
                    <Line
                        dataKey="lowAssetsCents"
                        dot={false}
                        isAnimationActive={false}
                        stroke="var(--color-lowAssetsCents)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        type="linear"
                    />
                    <Line
                        dataKey="expectedAssetsCents"
                        dot={false}
                        isAnimationActive={false}
                        stroke="var(--color-expectedAssetsCents)"
                        strokeDasharray="5 5"
                        strokeWidth={2.5}
                        type="linear"
                    />
                    <Line
                        dataKey="highAssetsCents"
                        dot={false}
                        isAnimationActive={false}
                        stroke="var(--color-highAssetsCents)"
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        type="linear"
                    />
                    {historicalAnnualIncreaseCents !== null ? (
                        <Line
                            dataKey="historicalPaceAssetsCents"
                            dot={false}
                            isAnimationActive={false}
                            stroke="var(--color-historicalPaceAssetsCents)"
                            strokeWidth={3}
                            type="linear"
                        />
                    ) : null}
                </LineChart>
            </ChartContainer>
        </div>
    )
}

export {
    AssetsProjectionChart,
    getTargetYear,
    getTrailingAssetIncrease,
    getYearsToTarget,
    getYearsToTargetAtPace,
}
