import {data} from "react-router"

import Insights from "~/components/Insights"
import {getDatabase} from "~/db/client"
import {getAllBalances, getSettings} from "~/db/queries"
import {calculateSpendingTrend} from "~/utils/finance"

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

    const captures = [...Map.groupBy(balances, balance => balance.date)]
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

    return {
        defaultWindow: settings.defaultWindow,
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
