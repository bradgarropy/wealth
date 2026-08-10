import type {Account, Balance, Settings} from "~/db/queries"

type BalanceSnapshotInput = Pick<Balance, "amountCents" | "date"> & {
    accountType: Account["type"]
}

export type FinanceSnapshot = {
    assetsCents: number
    date: string
    liabilitiesCents: number
    netWorthCents: number
}

export type FinanceChange = {
    amountCents: number
    percentage: number | null
}

export type SpendingCapture = {
    date: string
    spendingCents: number
}

export type SpendingTrendPoint = SpendingCapture & {
    allTimeAverageCents: number
}

type CaptureBalanceInput = Pick<Balance, "amountCents"> & {
    accountCategory: Account["category"]
    accountName: Account["name"]
    accountType: Account["type"]
}

type CaptureSettingsInput = Pick<
    Settings,
    "checkingBaselineCents" | "excessInvestPct" | "excessSavePct"
>

export type CaptureSummary = {
    assetsCents: number
    availableCheckingCents: number
    checkingCents: number
    investmentsSavedCents: number
    liabilitiesCents: number
    netWorthCents: number
    savingsSavedCents: number
    spendingCents: number
    totalSavedCents: number
}

export const calculateSnapshot = (
    date: string,
    balances: BalanceSnapshotInput[],
): FinanceSnapshot => {
    const totals = balances.reduce(
        (result, balance) => {
            if (balance.accountType === "asset") {
                result.assetsCents += balance.amountCents
            } else {
                result.liabilitiesCents += balance.amountCents
            }

            return result
        },
        {assetsCents: 0, liabilitiesCents: 0},
    )

    return {
        ...totals,
        date,
        netWorthCents: totals.assetsCents - totals.liabilitiesCents,
    }
}

export const calculateSnapshotSeries = (
    balances: BalanceSnapshotInput[],
): FinanceSnapshot[] => {
    const balancesByDate = Map.groupBy(balances, balance => balance.date)

    return [...balancesByDate.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, datedBalances]) => calculateSnapshot(date, datedBalances))
}

export const getSnapshotWindow = (
    snapshots: FinanceSnapshot[],
    window: number | "all",
) => {
    return window === "all" ? snapshots : snapshots.slice(-window)
}

export const calculateChange = (
    currentCents: number,
    previousCents: number,
): FinanceChange => {
    const amountCents = currentCents - previousCents

    return {
        amountCents,
        percentage: previousCents === 0 ? null : amountCents / previousCents,
    }
}

export const calculateSpendingTrend = (
    captures: SpendingCapture[],
): SpendingTrendPoint[] => {
    const chronologicalCaptures = [...captures].sort((left, right) =>
        left.date.localeCompare(right.date),
    )

    return chronologicalCaptures.map((capture, index) => {
        const averageWindow = chronologicalCaptures.slice(0, index + 1)
        const allTimeAverageCents = Math.round(
            averageWindow.reduce(
                (total, entry) => total + entry.spendingCents,
                0,
            ) / averageWindow.length,
        )

        return {...capture, allTimeAverageCents}
    })
}

export const calculateCaptureSummary = (
    balances: CaptureBalanceInput[],
    settings: CaptureSettingsInput,
): CaptureSummary => {
    const snapshot = calculateSnapshot(
        "",
        balances.map(balance => ({...balance, date: ""})),
    )
    const checkingCents =
        balances.find(balance => balance.accountName === "Checking")
            ?.amountCents ?? 0
    const spendingCents = balances
        .filter(balance => balance.accountCategory === "credit")
        .reduce((total, balance) => total + balance.amountCents, 0)
    const availableCheckingCents = checkingCents - spendingCents
    const totalSavedCents = Math.max(
        availableCheckingCents - settings.checkingBaselineCents,
        0,
    )
    const investmentsSavedCents = Math.round(
        (totalSavedCents * settings.excessInvestPct) / 100,
    )
    const savingsSavedCents = Math.round(
        (totalSavedCents * settings.excessSavePct) / 100,
    )

    return {
        assetsCents: snapshot.assetsCents,
        availableCheckingCents,
        checkingCents,
        investmentsSavedCents,
        liabilitiesCents: snapshot.liabilitiesCents,
        netWorthCents: snapshot.netWorthCents,
        savingsSavedCents,
        spendingCents,
        totalSavedCents,
    }
}
