import {Link} from "react-router"

import {SpendingChart} from "~/components/SpendingChart"
import type {SpendingTrendPoint} from "~/utils/finance"
import {formatDate} from "~/utils/format"

type InsightsProps = {
    defaultWindow: number
    spending: SpendingTrendPoint[]
}

const Insights = ({defaultWindow, spending}: InsightsProps) => {
    const latestDate = spending.at(-1)?.date

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

            {spending.length > 0 ? (
                <section className="min-w-0" aria-labelledby="spending-heading">
                    <div className="mb-6 space-y-1">
                        <h2
                            className="text-xl font-semibold"
                            id="spending-heading"
                        >
                            Spending
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Weekly credit-card spending with its cumulative
                            all-time average.
                        </p>
                    </div>

                    <SpendingChart
                        defaultWindow={defaultWindow}
                        points={spending}
                    />
                </section>
            ) : (
                <p className="border-y py-8 text-muted-foreground">
                    No balance snapshots yet.
                </p>
            )}
        </main>
    )
}

export default Insights
