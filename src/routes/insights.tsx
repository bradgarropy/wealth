import {data} from "react-router"

import Insights from "~/components/Insights"
import type {SavingsPoint} from "~/components/SavingsChart"
import {getDatabase} from "~/db/client"
import {getAllBalances, getSettings} from "~/db/queries"
import {
    calculateCaptureSummary,
    calculateSavingsRateTrend,
    calculateSnapshotSeries,
    calculateSpendingTrend,
    isSavingsTrackingDate,
} from "~/utils/finance"

import type {Route} from "./+types/insights"

export const loader = async ({context}: Route.LoaderArgs) => {
    const database = getDatabase(context.cloudflare.env)
    const [balances, settings] = await Promise.all([
        getAllBalances(database),
        getSettings(database),
    ])

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }

    const balancesByDate = [...Map.groupBy(balances, balance => balance.date)]
    const captures = balancesByDate
        .map(([date, datedBalances]) => {
            const creditBalances = datedBalances.filter(
                balance => balance.accountCategory === "credit",
            )

            if (creditBalances.length === 0) {
                return null
            }

            return {
                date,
                spendingCents: creditBalances.reduce(
                    (total, balance) => total + balance.amountCents,
                    0,
                ),
            }
        })
        .filter(capture => capture !== null)
    const savings: SavingsPoint[] = balancesByDate
        .filter(([date]) => isSavingsTrackingDate(date))
        .map(([date, datedBalances]) => {
            const summary = calculateCaptureSummary(datedBalances, settings)

            return {
                date,
                investmentsSavedCents: summary.investmentsSavedCents,
                savingsSavedCents: summary.savingsSavedCents,
                totalSavedCents: summary.totalSavedCents,
            }
        })
    const spendingByDate = new Map(
        captures.map(capture => [capture.date, capture.spendingCents]),
    )
    const savingsRate = calculateSavingsRateTrend(
        savings.flatMap(point => {
            const spendingCents = spendingByDate.get(point.date)

            return spendingCents === undefined
                ? []
                : [
                      {
                          date: point.date,
                          savedCents: point.totalSavedCents,
                          spendingCents,
                      },
                  ]
        }),
    )

    return {
        defaultWindow: settings.defaultWindow,
        snapshots: calculateSnapshotSeries(balances),
        savings,
        savingsRate,
        spending: calculateSpendingTrend(captures),
    }
}

const Route = ({loaderData}: Route.ComponentProps) => {
    return (
        <>
            <title>wealth | insights</title>
            <Insights {...loaderData} />
        </>
    )
}

export default Route
