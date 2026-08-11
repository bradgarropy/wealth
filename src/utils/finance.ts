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
    fiftyTwoWeekAverageCents: number | null
    twelveWeekAverageCents: number | null
}

export type SavingsRateCapture = {
    date: string
    savedCents: number
    spendingCents: number
}

export type SavingsRateTrendPoint = {
    allTimeRate: number
    date: string
    fiftyTwoWeekRate: number | null
    twelveWeekRate: number | null
}

export const legacySavingsDates = [
    "2025-09-15",
    "2025-10-15",
    "2025-11-15",
    "2025-12-15",
] as const

export const savingsTrackingStartDate = "2026-01-01"

export const isSavingsTrackingDate = (date: string) => {
    return (
        date >= savingsTrackingStartDate ||
        legacySavingsDates.some(legacyDate => legacyDate === date)
    )
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
        const calculateWindowAverage = (window: number) => {
            if (index < window - 1) {
                return null
            }

            const capturesInWindow = chronologicalCaptures.slice(
                index - window + 1,
                index + 1,
            )

            return Math.round(
                capturesInWindow.reduce(
                    (total, entry) => total + entry.spendingCents,
                    0,
                ) / window,
            )
        }

        return {
            ...capture,
            allTimeAverageCents,
            fiftyTwoWeekAverageCents: calculateWindowAverage(52),
            twelveWeekAverageCents: calculateWindowAverage(12),
        }
    })
}

export const calculateSavingsRateTrend = (
    captures: SavingsRateCapture[],
): SavingsRateTrendPoint[] => {
    const chronologicalCaptures = [...captures].sort((left, right) =>
        left.date.localeCompare(right.date),
    )

    const calculateRate = (entries: SavingsRateCapture[]) => {
        const totals = entries.reduce(
            (result, entry) => ({
                savedCents: result.savedCents + entry.savedCents,
                spendingCents: result.spendingCents + entry.spendingCents,
            }),
            {savedCents: 0, spendingCents: 0},
        )
        const availableCents = totals.savedCents + totals.spendingCents

        return availableCents === 0 ? 0 : totals.savedCents / availableCents
    }

    return chronologicalCaptures.map((capture, index) => {
        const calculateWindowRate = (window: number) => {
            if (index < window - 1) {
                return null
            }

            return calculateRate(
                chronologicalCaptures.slice(index - window + 1, index + 1),
            )
        }

        return {
            allTimeRate: calculateRate(
                chronologicalCaptures.slice(0, index + 1),
            ),
            date: capture.date,
            fiftyTwoWeekRate: calculateWindowRate(52),
            twelveWeekRate: calculateWindowRate(12),
        }
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
