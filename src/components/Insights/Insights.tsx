import {Link} from "react-router"

import {SavingsChart, type SavingsPoint} from "~/components/SavingsChart"
import {SpendingChart} from "~/components/SpendingChart"
import type {SavingsRateTrendPoint, SpendingTrendPoint} from "~/utils/finance"
import {formatDate} from "~/utils/format"

type InsightsProps = {
    defaultWindow: number
    savings: SavingsPoint[]
    savingsRate: SavingsRateTrendPoint[]
    spending: SpendingTrendPoint[]
}

const Insights = ({
    defaultWindow,
    savings,
    savingsRate,
    spending,
}: InsightsProps) => {
    const latestDate = [...spending, ...savings]
        .map(point => point.date)
        .sort()
        .at(-1)

    return (
        <main className="mx-auto w-full max-w-5xl py-8 sm:py-16">
            <div className="mb-10 space-y-2">
                <h1 className="text-3xl font-bold">Insights</h1>
                <p className="text-muted-foreground">
                    {latestDate ? (
                        <>
                            Latest capture:{" "}
                            <Link
                                className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                to={"/capture/" + latestDate}
                            >
                                {formatDate(latestDate)}
                            </Link>
                        </>
                    ) : (
                        "Understand the trends behind your financial captures."
                    )}
                </p>
            </div>

            {spending.length === 0 && savings.length === 0 ? (
                <p className="border-y py-8 text-muted-foreground">
                    No balance snapshots yet.
                </p>
            ) : (
                <div className="space-y-16">
                    {spending.length > 0 && (
                        <section
                            className="min-w-0"
                            aria-labelledby="spending-heading"
                        >
                            <div className="mb-6 space-y-1">
                                <h2
                                    className="text-xl font-semibold"
                                    id="spending-heading"
                                >
                                    Spending
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Weekly credit-card spending with its
                                    cumulative all-time average.
                                </p>
                            </div>

                            <SpendingChart
                                defaultWindow={defaultWindow}
                                points={spending}
                            />
                        </section>
                    )}

                    {savings.length > 0 && (
                        <section
                            className="min-w-0"
                            aria-labelledby="savings-heading"
                        >
                            <div className="mb-6 space-y-1">
                                <h2
                                    className="text-xl font-semibold"
                                    id="savings-heading"
                                >
                                    Savings
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Recommended transfers split between
                                    Investments and Savings.
                                </p>
                            </div>

                            <SavingsChart
                                defaultWindow={defaultWindow}
                                points={savings}
                                ratePoints={savingsRate}
                            />
                        </section>
                    )}
                </div>
            )}
        </main>
    )
}

export default Insights
