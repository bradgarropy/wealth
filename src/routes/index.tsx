import {data, Link} from "react-router"

import {
    type LatestAccountBalance,
    LatestAccountSnapshot,
} from "~/components/LatestAccountSnapshot"
import {NetWorthChart} from "~/components/NetWorthChart"
import {getDatabaseFromContext} from "~/db/client"
import {getAccounts, getAllBalances, getSettings} from "~/db/queries"
import {
    calculateChange,
    calculateSnapshotSeries,
    type FinanceChange,
} from "~/utils/finance"
import {
    formatDate,
    formatMoney,
    formatMoneyChange,
    formatPercentageChange,
} from "~/utils/format"

import type {Route} from "./+types/index"

type SnapshotDeltaProps = {
    change: FinanceChange | null
    favorableDirection: "increase" | "decrease"
}

const SnapshotDelta = ({change, favorableDirection}: SnapshotDeltaProps) => {
    if (!change) {
        return <p className="mt-2 text-sm text-muted-foreground">-</p>
    }

    const isFavorable =
        change.amountCents === 0
            ? null
            : favorableDirection === "increase"
              ? change.amountCents > 0
              : change.amountCents < 0
    const color =
        isFavorable === null
            ? "text-muted-foreground"
            : isFavorable
              ? "text-financial-positive-foreground"
              : "text-financial-negative-foreground"

    return (
        <p className="mt-1 text-xs tabular-nums sm:mt-2 sm:text-sm">
            <span className={color}>
                {formatMoneyChange(change.amountCents)}
                {change.percentage === null
                    ? null
                    : ` (${formatPercentageChange(change.percentage)})`}
            </span>
        </p>
    )
}

export const loader = async ({context}: Route.LoaderArgs) => {
    const database = getDatabaseFromContext(context)
    const [accounts, balances, settings] = await Promise.all([
        getAccounts(database),
        getAllBalances(database),
        getSettings(database),
    ])

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }
    const snapshots = calculateSnapshotSeries(balances)
    const latestDate = snapshots.at(-1)?.date
    const latestBalancesByAccountId = new Map(
        balances
            .filter(balance => balance.date === latestDate)
            .map(balance => [balance.accountId, balance]),
    )
    const latestBalances: LatestAccountBalance[] = accounts
        .filter(account => !account.archived)
        .map(account => ({
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            amountCents:
                latestBalancesByAccountId.get(account.id)?.amountCents ?? null,
        }))

    return {
        defaultWindow: settings.defaultWindow,
        latestBalances,
        snapshots,
    }
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const latest = loaderData.snapshots.at(-1)
    const previous = loaderData.snapshots.at(-2)
    const changes =
        latest && previous
            ? {
                  assets: calculateChange(
                      latest.assetsCents,
                      previous.assetsCents,
                  ),
                  liabilities: calculateChange(
                      latest.liabilitiesCents,
                      previous.liabilitiesCents,
                  ),
                  netWorth: calculateChange(
                      latest.netWorthCents,
                      previous.netWorthCents,
                  ),
              }
            : null

    return (
        <>
            <title>wealth | overview</title>

            <main className="mx-auto w-full min-w-0 max-w-5xl py-4 sm:py-16">
                <div className="mb-8 space-y-2 sm:mb-10">
                    <h1 className="text-3xl font-bold">Overview</h1>
                    <p className="text-muted-foreground">
                        {latest ? (
                            <>
                                Latest capture:{" "}
                                <Link
                                    className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                    to={`/capture/${latest.date}`}
                                >
                                    {formatDate(latest.date)}
                                </Link>
                            </>
                        ) : (
                            "Your latest financial snapshot."
                        )}
                    </p>
                </div>

                {latest ? (
                    <>
                        <section
                            aria-label="Latest financial snapshot"
                            className="grid grid-cols-2 border-y sm:grid-cols-3 sm:divide-x"
                        >
                            <div className="py-5 pr-3 sm:px-6 sm:py-6 sm:first:pl-0">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Assets
                                </p>
                                <p className="mt-2 whitespace-nowrap text-lg font-semibold tabular-nums sm:text-3xl">
                                    {formatMoney(latest.assetsCents)}
                                </p>
                                <SnapshotDelta
                                    change={changes?.assets ?? null}
                                    favorableDirection="increase"
                                />
                            </div>

                            <div className="border-l py-5 pl-3 sm:border-l-0 sm:px-6 sm:py-6">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Liabilities
                                </p>
                                <p className="mt-2 whitespace-nowrap text-lg font-semibold tabular-nums sm:text-3xl">
                                    {formatMoney(latest.liabilitiesCents)}
                                </p>
                                <SnapshotDelta
                                    change={changes?.liabilities ?? null}
                                    favorableDirection="decrease"
                                />
                            </div>

                            <div className="col-span-2 border-t py-5 sm:col-span-1 sm:border-t-0 sm:px-6 sm:py-6 sm:last:pr-0">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Net worth
                                </p>
                                <p className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">
                                    {formatMoney(latest.netWorthCents)}
                                </p>
                                <SnapshotDelta
                                    change={changes?.netWorth ?? null}
                                    favorableDirection="increase"
                                />
                            </div>
                        </section>

                        <section
                            className="mt-10 min-w-0 sm:mt-14"
                            aria-labelledby="history-heading"
                        >
                            <div className="mb-6 space-y-1">
                                <h2
                                    className="text-xl font-semibold"
                                    id="history-heading"
                                >
                                    Financial history
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Assets, liabilities, and net worth over
                                    time.
                                </p>
                            </div>

                            <NetWorthChart
                                defaultWindow={loaderData.defaultWindow}
                                snapshots={loaderData.snapshots}
                            />
                        </section>

                        <LatestAccountSnapshot
                            balances={loaderData.latestBalances}
                        />
                    </>
                ) : (
                    <p className="border-y py-8 text-muted-foreground">
                        No balance snapshots yet.
                    </p>
                )}
            </main>
        </>
    )
}

export default Route
