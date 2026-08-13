import {ChevronLeftIcon, ChevronRightIcon, PlusIcon} from "lucide-react"
import {data, Link} from "react-router"
import {z} from "zod"

import {buttonVariants} from "~/components/ui/button"
import {ACCOUNT} from "~/constants"
import {getDatabase} from "~/db/client"
import {getBalancesByDate, getCaptureDates, getSettings} from "~/db/queries"
import {calculateCaptureSummary} from "~/utils/finance"
import {formatDate, formatMoney} from "~/utils/format"

import type {Route} from "./+types/capture-summary"

export const loader = async ({context, params}: Route.LoaderArgs) => {
    const dateResult = z.iso.date().safeParse(params.date)

    if (!dateResult.success) {
        throw data("Invalid capture date.", {status: 400})
    }

    const db = getDatabase(context.cloudflare.env)
    const [balances, captureDates, settings] = await Promise.all([
        getBalancesByDate(db, dateResult.data),
        getCaptureDates(db),
        getSettings(db),
    ])

    if (balances.length === 0) {
        throw data("Capture not found.", {status: 404})
    }

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }

    const captureIndex = captureDates.findIndex(
        capture => capture.date === dateResult.data,
    )

    return {
        balances,
        date: dateResult.data,
        nextDate: captureDates[captureIndex + 1]?.date ?? null,
        previousDate: captureDates[captureIndex - 1]?.date ?? null,
        summary: calculateCaptureSummary(balances, settings),
    }
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const {balances, date, nextDate, previousDate, summary} = loaderData
    const assetBalances = balances.filter(
        balance => balance.accountType === "asset",
    )
    const liabilityBalances = balances.filter(
        balance => balance.accountType === "liability",
    )
    const creditBalances = balances.filter(
        balance =>
            balance.accountCategory === "credit" && balance.amountCents > 0,
    )
    const investmentAccount = balances.find(
        balance => balance.accountName === ACCOUNT.INVESTMENT,
    )
    const savingsAccount = balances.find(
        balance => balance.accountName === ACCOUNT.SAVINGS,
    )
    const balanceGroups = [
        {
            balances: assetBalances,
            description: "Cash, savings, and investments.",
            label: "Assets",
        },
        {
            balances: liabilityBalances,
            description: "Credit cards and outstanding loans.",
            label: "Liabilities",
        },
    ]

    return (
        <>
            <title>wealth | capture summary</title>

            <main className="mx-auto w-full max-w-3xl py-8 sm:py-16">
                <header className="mb-10 flex flex-col items-start justify-between gap-6 sm:flex-row">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold">Capture summary</h1>
                        <nav
                            aria-label="Capture navigation"
                            className="flex items-center gap-1"
                        >
                            {previousDate ? (
                                <Link
                                    aria-label={`Previous capture: ${formatDate(previousDate)}`}
                                    className={buttonVariants({
                                        size: "icon-sm",
                                        variant: "ghost",
                                    })}
                                    title={`Previous capture: ${formatDate(previousDate)}`}
                                    to={`/capture/${previousDate}`}
                                >
                                    <ChevronLeftIcon />
                                </Link>
                            ) : (
                                <span aria-hidden className="size-7" />
                            )}

                            <p className="min-w-32 text-center text-muted-foreground">
                                {formatDate(date)}
                            </p>

                            {nextDate ? (
                                <Link
                                    aria-label={`Next capture: ${formatDate(nextDate)}`}
                                    className={buttonVariants({
                                        size: "icon-sm",
                                        variant: "ghost",
                                    })}
                                    title={`Next capture: ${formatDate(nextDate)}`}
                                    to={`/capture/${nextDate}`}
                                >
                                    <ChevronRightIcon />
                                </Link>
                            ) : (
                                <span aria-hidden className="size-7" />
                            )}
                        </nav>
                    </div>

                    <Link className={buttonVariants()} to="/capture">
                        <PlusIcon />
                        New capture
                    </Link>
                </header>

                <section
                    aria-label="Financial snapshot totals"
                    className="mb-14 grid border-y sm:grid-cols-3 sm:divide-x"
                >
                    <div className="py-6 sm:px-6 sm:first:pl-0">
                        <p className="text-sm font-medium text-muted-foreground">
                            Assets
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {formatMoney(summary.assetsCents)}
                        </p>
                    </div>

                    <div className="border-t py-6 sm:border-t-0 sm:px-6">
                        <p className="text-sm font-medium text-muted-foreground">
                            Liabilities
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {formatMoney(summary.liabilitiesCents)}
                        </p>
                    </div>

                    <div className="border-t py-6 sm:border-t-0 sm:px-6 sm:last:pr-0">
                        <p className="text-sm font-medium text-muted-foreground">
                            Net worth
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {formatMoney(summary.netWorthCents)}
                        </p>
                    </div>
                </section>

                <section aria-label="Balances" className="mb-16">
                    <div className="grid gap-12 sm:grid-cols-2 sm:gap-10">
                        {balanceGroups.map(group => (
                            <section key={group.label}>
                                <div className="mb-3 space-y-1">
                                    <h2 className="text-xl font-semibold">
                                        {group.label}
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        {group.description}
                                    </p>
                                </div>

                                <div className="divide-y border-y">
                                    {group.balances.map(balance => (
                                        <div
                                            key={balance.id}
                                            className="flex items-center justify-between gap-6 py-3"
                                        >
                                            <Link
                                                className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                                to={`/account/${balance.accountId}`}
                                            >
                                                {balance.accountName}
                                            </Link>
                                            <span className="tabular-nums">
                                                {formatMoney(
                                                    balance.amountCents,
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </section>

                <section
                    aria-label="Cash flow totals"
                    className="mb-14 grid border-y sm:grid-cols-2 sm:divide-x"
                >
                    <div className="py-6 sm:pr-6">
                        <p className="text-sm font-medium text-muted-foreground">
                            Spent
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {formatMoney(summary.spendingCents)}
                        </p>
                    </div>

                    <div className="border-t py-6 sm:border-t-0 sm:pl-6">
                        <p className="text-sm font-medium text-muted-foreground">
                            Saved
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                            {formatMoney(summary.totalSavedCents)}
                        </p>
                    </div>
                </section>

                <div className="grid gap-16 sm:grid-cols-2 sm:gap-10">
                    <section aria-label="Spending breakdown">
                        <div className="mb-3 space-y-1">
                            <h2 className="text-xl font-semibold">Spent</h2>
                            <p className="text-sm text-muted-foreground">
                                Credit balances to pay this week.
                            </p>
                        </div>

                        <div className="divide-y border-y">
                            {creditBalances.map(balance => (
                                <div
                                    key={balance.id}
                                    className="flex items-center justify-between gap-6 py-3"
                                >
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                        to={`/account/${balance.accountId}`}
                                    >
                                        {balance.accountName}
                                    </Link>
                                    <span className="tabular-nums">
                                        {formatMoney(balance.amountCents)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section aria-label="Savings breakdown">
                        <div className="mb-3 space-y-1">
                            <h2 className="text-xl font-semibold">Saved</h2>
                            <p className="text-sm text-muted-foreground">
                                Recommended transfers after card payments.
                            </p>
                        </div>

                        <div className="divide-y border-y">
                            <div className="flex items-center justify-between gap-6 py-3">
                                {investmentAccount ? (
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                        to={`/account/${investmentAccount.accountId}`}
                                    >
                                        Investments
                                    </Link>
                                ) : (
                                    <span className="font-medium">
                                        Investments
                                    </span>
                                )}
                                <span className="tabular-nums">
                                    {formatMoney(summary.investmentsSavedCents)}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-6 py-3">
                                {savingsAccount ? (
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                                        to={`/account/${savingsAccount.accountId}`}
                                    >
                                        Savings
                                    </Link>
                                ) : (
                                    <span className="font-medium">Savings</span>
                                )}
                                <span className="tabular-nums">
                                    {formatMoney(summary.savingsSavedCents)}
                                </span>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </>
    )
}

export default Route
