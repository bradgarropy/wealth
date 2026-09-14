import {ChevronLeftIcon} from "lucide-react"
import {data, Link} from "react-router"
import {z} from "zod"

import {AccountBalanceChart} from "~/components/AccountBalanceChart"
import {AccountTypeBadge} from "~/components/AccountTypeBadge"
import {BalanceTable} from "~/components/BalanceTable"
import {Badge} from "~/components/ui/badge"
import {buttonVariants} from "~/components/ui/button"
import {getDatabaseFromContext} from "~/db/client"
import {getAccount, getBalancesByAccountId, getSettings} from "~/db/queries"

import type {Route} from "./+types/account-summary"

export const loader = async ({context, params}: Route.LoaderArgs) => {
    const accountIdResult = z.coerce
        .number()
        .int()
        .positive()
        .safeParse(params.accountId)

    if (!accountIdResult.success) {
        throw data("Invalid account id.", {status: 400})
    }

    const db = getDatabaseFromContext(context)
    const [account, balances, settings] = await Promise.all([
        getAccount(db, accountIdResult.data),
        getBalancesByAccountId(db, accountIdResult.data),
        getSettings(db),
    ])

    if (!account) {
        throw data("Account not found.", {status: 404})
    }

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }

    return {account, balances, defaultWindow: settings.defaultWindow}
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const {account, balances} = loaderData

    return (
        <>
            <title>{`wealth | ${account.name}`}</title>

            <main className="mx-auto w-full max-w-3xl py-8 sm:py-16">
                <header className="mb-10 space-y-6">
                    <Link
                        className={buttonVariants({
                            size: "sm",
                            variant: "ghost",
                        })}
                        to="/accounts"
                    >
                        <ChevronLeftIcon />
                        Accounts
                    </Link>

                    <div className="space-y-3">
                        <h1 className="text-3xl font-bold">{account.name}</h1>

                        <div className="flex flex-wrap items-center gap-2">
                            <AccountTypeBadge type={account.type} />
                            <Badge variant="outline" className="capitalize">
                                {account.category}
                            </Badge>
                            {account.archived ? (
                                <Badge variant="secondary">Archived</Badge>
                            ) : null}
                        </div>
                    </div>
                </header>

                <section aria-labelledby="balance-history-heading">
                    <div className="mb-3 space-y-1">
                        <h2
                            id="balance-history-heading"
                            className="text-xl font-semibold"
                        >
                            Balance history
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Recorded balances for this account.
                        </p>
                    </div>

                    {balances.length > 0 ? (
                        <div className="space-y-10">
                            <AccountBalanceChart
                                accountType={account.type}
                                balances={balances}
                                defaultWindow={loaderData.defaultWindow}
                            />
                            <BalanceTable balances={balances} />
                        </div>
                    ) : (
                        <p className="border-t py-6 text-sm text-muted-foreground">
                            No balance history.
                        </p>
                    )}
                </section>
            </main>
        </>
    )
}

export default Route
