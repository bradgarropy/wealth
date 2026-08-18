import {Field} from "@base-ui/react/field"
import {
    ArrowRightIcon,
    CheckIcon,
    CircleCheckIcon,
    CopyIcon,
} from "lucide-react"
import {useEffect, useState} from "react"
import {data, Link, useFetcher} from "react-router"

import BalanceInput from "~/components/BalanceInput"
import DateInput from "~/components/DateInput"
import {Badge} from "~/components/ui/badge"
import {Button, buttonVariants} from "~/components/ui/button"
import {Checkbox} from "~/components/ui/checkbox"
import {Progress, ProgressLabel, ProgressValue} from "~/components/ui/progress"
import {ACCOUNT} from "~/constants"
import {getDatabase} from "~/db/client"
import {
    getAccounts,
    getLatestBalances,
    getSettings,
    upsertBalances,
} from "~/db/queries"
import {captureSchema} from "~/schemas/capture"
import {calculateCaptureSummary} from "~/utils/finance"
import {formatDate, formatDateInput, formatMoney} from "~/utils/format"

import type {Route} from "./+types/capture"

const formatBalance = (value: number | null) => {
    return value === null ? "-" : formatMoney(Math.round(value * 100))
}

type CopyTransferAmountProps = {
    amountCents: number
    label: string
}

const CopyTransferAmount = ({amountCents, label}: CopyTransferAmountProps) => {
    const [copied, setCopied] = useState(false)
    const amount = formatMoney(amountCents)

    useEffect(() => {
        if (!copied) return

        const timeout = window.setTimeout(() => setCopied(false), 2_000)

        return () => window.clearTimeout(timeout)
    }, [copied])

    const handleCopy = async () => {
        await navigator.clipboard.writeText((amountCents / 100).toFixed(2))
        setCopied(true)
    }

    return (
        <>
            <Button
                aria-label={`Copy ${amount} transfer to ${label}`}
                className="ml-auto -mr-2 text-base font-normal tabular-nums"
                size="sm"
                title={`Copy ${amount}`}
                type="button"
                variant="ghost"
                onClick={handleCopy}
            >
                {amount}
                {copied ? (
                    <CheckIcon aria-hidden="true" />
                ) : (
                    <CopyIcon aria-hidden="true" />
                )}
            </Button>
            <span aria-live="polite" className="sr-only">
                {copied ? `${amount} copied` : ""}
            </span>
        </>
    )
}

export const action = async ({context, request}: Route.ActionArgs) => {
    const formData = await request.formData()
    let balances: unknown

    try {
        balances = JSON.parse(String(formData.get("balances")))
    } catch {
        balances = null
    }

    const result = captureSchema.safeParse({
        balances,
        date: formData.get("date"),
    })

    if (!result.success) {
        return data(
            {
                date: null,
                error: "Check the date and balances, then try again.",
            },
            {status: 400},
        )
    }

    await upsertBalances(
        getDatabase(context.cloudflare.env),
        result.data.date,
        result.data.balances,
    )

    return {date: result.data.date, error: null}
}

export const loader = async ({context}: Route.LoaderArgs) => {
    const database = getDatabase(context.cloudflare.env)

    const [accounts, latestBalances, settings] = await Promise.all([
        getAccounts(database),
        getLatestBalances(database),
        getSettings(database),
    ])

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }

    const latestBalancesByAccountId = new Map(
        latestBalances.map(balance => [balance.accountId, balance.amountCents]),
    )

    return {
        accounts: accounts
            .filter(account => !account.archived)
            .map(account => ({
                category: account.category,
                defaultAmountCents:
                    account.name === ACCOUNT.EMERGENCY ||
                    account.category === "mortgage"
                        ? (latestBalancesByAccountId.get(account.id) ?? null)
                        : null,
                id: account.id,
                name: account.name,
                type: account.type,
            })),
        settings,
    }
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const {accounts, settings} = loaderData
    const fetcher = useFetcher<typeof action>()
    const [date, setDate] = useState(() => formatDateInput(new Date()))
    const [step, setStep] = useState(0)
    const [balances, setBalances] = useState<Record<number, number | null>>(
        () =>
            Object.fromEntries(
                accounts.map(account => [
                    account.id,
                    account.defaultAmountCents === null
                        ? null
                        : account.defaultAmountCents / 100,
                ]),
            ),
    )
    const [paidAccounts, setPaidAccounts] = useState<Record<number, boolean>>(
        {},
    )
    const [completedTransfers, setCompletedTransfers] = useState<
        Record<string, boolean>
    >({})
    const confirmStep = accounts.length + 1
    const paymentStep = confirmStep + 1
    const savingsStep = paymentStep + 1
    const finishStep = savingsStep + 1
    const totalSteps = finishStep + 1
    const isConfirmStep = step === confirmStep
    const currentAccount =
        step > 0 && step <= accounts.length ? accounts[step - 1] : null
    const isLastAccount = step === accounts.length
    const isCurrentBalanceMissing =
        currentAccount !== null && balances[currentAccount.id] === null
    const hasMissingBalances = accounts.some(
        account => balances[account.id] === null,
    )
    const balanceEntries = accounts.flatMap(account => {
        const amount = balances[account.id]

        return amount === null
            ? []
            : [{accountId: account.id, amountCents: Math.round(amount * 100)}]
    })
    const capturedBalances = accounts.map(account => ({
        accountCategory: account.category,
        accountName: account.name,
        accountType: account.type,
        amountCents: Math.round((balances[account.id] ?? 0) * 100),
    }))
    const summary = calculateCaptureSummary(capturedBalances, settings)
    const creditBalances = accounts
        .filter(
            account =>
                account.category === "credit" &&
                (balances[account.id] ?? 0) > 0,
        )
        .map(account => ({
            ...account,
            amountCents: Math.round((balances[account.id] ?? 0) * 100),
        }))
    const transfers = [
        {
            amountCents: summary.investmentsSavedCents,
            id: "investments",
            label: "Investments",
            percentage: settings.excessInvestPct,
        },
        {
            amountCents: summary.savingsSavedCents,
            id: "savings",
            label: "Savings",
            percentage: settings.excessSavePct,
        },
    ].filter(transfer => transfer.amountCents > 0)
    const paymentsComplete = creditBalances.every(
        account => paidAccounts[account.id],
    )
    const transfersComplete = transfers.every(
        transfer => completedTransfers[transfer.id],
    )
    const isSaving = fetcher.state !== "idle"
    const stepLabel =
        step === 0
            ? "Date"
            : currentAccount
              ? "Account"
              : isConfirmStep
                ? "Confirm"
                : step === paymentStep
                  ? "Pay cards"
                  : step === savingsStep
                    ? "Move savings"
                    : "Finish"
    const accountGroups = [
        {
            accounts: accounts.filter(account => account.type === "asset"),
            label: "Assets",
        },
        {
            accounts: accounts.filter(account => account.type === "liability"),
            label: "Liabilities",
        },
    ]

    useEffect(() => {
        if (fetcher.data?.date) {
            setStep(paymentStep)
        }
    }, [fetcher.data, paymentStep])

    const handleBegin = () => {
        setStep(1)
    }

    const handleNext = () => {
        setStep(currentStep => currentStep + 1)
    }

    const handleBack = () => {
        setStep(currentStep => Math.max(0, currentStep - 1))
    }

    return (
        <>
            <title>wealth | capture</title>

            <main className="mx-auto flex w-full max-w-xl flex-col gap-10 py-8 sm:py-16">
                <Progress
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 **:data-[slot=progress-track]:col-start-2 **[data-slot=progress-track]:row-start-1"
                    max={totalSteps}
                    value={step + 1}
                    getAriaValueText={(_, value) =>
                        `Step ${value ?? 0} of ${totalSteps}`
                    }
                >
                    <ProgressLabel className="text-muted-foreground">
                        {stepLabel}
                    </ProgressLabel>

                    <ProgressValue className="col-start-3 row-start-1 ml-0">
                        {(_, value) => `${value} of ${totalSteps}`}
                    </ProgressValue>
                </Progress>

                {step === 0 ? (
                    <>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold">
                                When are these balances from?
                            </h1>

                            <p className="max-w-md text-base leading-7 text-neutral-600">
                                Choose the date that best represents this
                                financial snapshot.
                            </p>
                        </div>

                        <div className="space-y-8">
                            <Field.Root
                                className="flex flex-col gap-2"
                                name="date"
                            >
                                <Field.Label
                                    id="balance-date-label"
                                    className="block text-right text-sm font-medium"
                                >
                                    Balance date
                                </Field.Label>

                                <DateInput
                                    aria-labelledby="balance-date-label"
                                    value={date}
                                    onValueChange={setDate}
                                />
                            </Field.Root>

                            <Button
                                disabled={accounts.length === 0}
                                size="lg"
                                type="button"
                                onClick={handleBegin}
                                className="h-12 w-full"
                            >
                                Begin capture
                            </Button>
                        </div>
                    </>
                ) : null}

                {currentAccount ? (
                    <form
                        className="space-y-8"
                        onSubmit={event => {
                            event.preventDefault()

                            if (!isCurrentBalanceMissing) {
                                handleNext()
                            }
                        }}
                    >
                        <BalanceInput
                            key={currentAccount.id}
                            account={currentAccount}
                            value={balances[currentAccount.id]}
                            onValueChange={value =>
                                setBalances(currentBalances => ({
                                    ...currentBalances,
                                    [currentAccount.id]: value,
                                }))
                            }
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                size="lg"
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                                className="h-12"
                            >
                                Back
                            </Button>

                            <Button
                                disabled={isCurrentBalanceMissing}
                                size="lg"
                                type="submit"
                                className="h-12"
                            >
                                {isLastAccount
                                    ? "Confirm balances"
                                    : "Next account"}
                            </Button>
                        </div>
                    </form>
                ) : null}

                {isConfirmStep ? (
                    <fetcher.Form method="post" className="contents">
                        <input name="date" type="hidden" value={date} />
                        <input
                            name="balances"
                            type="hidden"
                            value={JSON.stringify(balanceEntries)}
                        />

                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold">
                                Confirm balances
                            </h1>

                            <p className="text-base text-neutral-600">
                                Snapshot for {formatDate(date)}
                            </p>
                        </div>

                        <div className="space-y-12">
                            {accountGroups.map(group => (
                                <section
                                    key={group.label}
                                    className="space-y-3"
                                >
                                    <h2 className="text-sm font-semibold uppercase text-neutral-500">
                                        {group.label}
                                    </h2>

                                    <div className="divide-y divide-neutral-200 border-t border-neutral-200">
                                        {group.accounts.map(account => (
                                            <div
                                                key={account.id}
                                                className="flex items-center justify-between gap-6 py-4"
                                            >
                                                <span className="font-medium">
                                                    {account.name}
                                                </span>

                                                <span className="tabular-nums">
                                                    {formatBalance(
                                                        balances[account.id],
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                size="lg"
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                                className="h-12"
                            >
                                Back
                            </Button>

                            <Button
                                disabled={hasMissingBalances || isSaving}
                                size="lg"
                                type="submit"
                                className="h-12"
                            >
                                {isSaving
                                    ? "Saving..."
                                    : "Confirm and continue"}
                            </Button>
                        </div>

                        {fetcher.data?.error ? (
                            <p
                                role="alert"
                                className="text-center text-sm text-destructive"
                            >
                                {fetcher.data.error}
                            </p>
                        ) : null}
                    </fetcher.Form>
                ) : null}

                {step === paymentStep ? (
                    <>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold">
                                Pay off your credit cards
                            </h1>
                            <p className="text-base leading-7 text-muted-foreground">
                                Pay each balance from Checking, then check it
                                off.
                            </p>
                        </div>

                        {creditBalances.length > 0 ? (
                            <div className="divide-y border-y">
                                {creditBalances.map(account => {
                                    const checkboxId = `payment-${account.id}`

                                    return (
                                        <label
                                            key={account.id}
                                            className="flex cursor-pointer items-center gap-3 py-4"
                                            htmlFor={checkboxId}
                                        >
                                            <Checkbox
                                                checked={
                                                    paidAccounts[account.id] ??
                                                    false
                                                }
                                                id={checkboxId}
                                                onCheckedChange={checked =>
                                                    setPaidAccounts(
                                                        current => ({
                                                            ...current,
                                                            [account.id]:
                                                                checked,
                                                        }),
                                                    )
                                                }
                                            />
                                            <span className="font-medium">
                                                {account.name}
                                            </span>
                                            <span className="ml-auto tabular-nums">
                                                {formatMoney(
                                                    account.amountCents,
                                                )}
                                            </span>
                                        </label>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="border-y py-6 text-muted-foreground">
                                No card payments this week.
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                className="h-12"
                                size="lg"
                                type="button"
                                variant="outline"
                                onClick={() => setStep(confirmStep)}
                            >
                                Back
                            </Button>
                            <Button
                                className="h-12"
                                disabled={!paymentsComplete}
                                size="lg"
                                type="button"
                                onClick={() => setStep(savingsStep)}
                            >
                                Continue
                            </Button>
                        </div>
                    </>
                ) : null}

                {step === savingsStep ? (
                    <>
                        <div className="space-y-3">
                            <h1 className="text-3xl font-bold">
                                Move your excess cash
                            </h1>
                            <p className="text-base leading-7 text-muted-foreground">
                                Make these transfers after the card payments
                                clear.
                            </p>
                        </div>

                        {transfers.length > 0 ? (
                            <div className="divide-y border-y">
                                {transfers.map(transfer => {
                                    const checkboxId = `transfer-${transfer.id}`

                                    return (
                                        <div
                                            key={transfer.id}
                                            className="flex items-center gap-3 py-3.5"
                                        >
                                            <Checkbox
                                                checked={
                                                    completedTransfers[
                                                        transfer.id
                                                    ] ?? false
                                                }
                                                id={checkboxId}
                                                onCheckedChange={checked =>
                                                    setCompletedTransfers(
                                                        current => ({
                                                            ...current,
                                                            [transfer.id]:
                                                                checked,
                                                        }),
                                                    )
                                                }
                                            />
                                            <label
                                                className="flex min-w-0 cursor-pointer items-center gap-2 font-medium"
                                                htmlFor={checkboxId}
                                            >
                                                <span>Checking</span>
                                                <ArrowRightIcon
                                                    aria-hidden="true"
                                                    className="size-4 shrink-0 text-muted-foreground"
                                                />
                                                <span>{transfer.label}</span>
                                                <Badge variant="secondary">
                                                    {transfer.percentage}%
                                                </Badge>
                                            </label>
                                            <CopyTransferAmount
                                                amountCents={
                                                    transfer.amountCents
                                                }
                                                label={transfer.label}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="border-y py-6 text-muted-foreground">
                                No savings transfers this week.
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                className="h-12"
                                size="lg"
                                type="button"
                                variant="outline"
                                onClick={() => setStep(paymentStep)}
                            >
                                Back
                            </Button>
                            <Button
                                className="h-12"
                                disabled={!transfersComplete}
                                size="lg"
                                type="button"
                                onClick={() => setStep(finishStep)}
                            >
                                Finish
                            </Button>
                        </div>
                    </>
                ) : null}

                {step === finishStep ? (
                    <>
                        <div className="space-y-4 text-center">
                            <CircleCheckIcon className="mx-auto size-12" />
                            <div className="space-y-2">
                                <h1 className="text-3xl font-bold">
                                    Weekly finances complete
                                </h1>
                                <p className="text-muted-foreground">
                                    {formatDate(date)}
                                </p>
                            </div>
                        </div>

                        <Link
                            className={buttonVariants({
                                className: "h-12 w-full",
                                size: "lg",
                            })}
                            to={`/capture/${date}`}
                        >
                            View capture summary
                        </Link>
                    </>
                ) : null}
            </main>
        </>
    )
}

export default Route
