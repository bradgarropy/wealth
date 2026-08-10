import {expect, test} from "vitest"

import {
    calculateCaptureSummary,
    calculateChange,
    calculateSnapshot,
    calculateSnapshotSeries,
    calculateSpendingTrend,
    getSnapshotWindow,
} from "~/utils/finance"

test("calculates absolute and percentage changes", () => {
    expect(calculateChange(125_000, 100_000)).toEqual({
        amountCents: 25_000,
        percentage: 0.25,
    })
    expect(calculateChange(75_000, 100_000)).toEqual({
        amountCents: -25_000,
        percentage: -0.25,
    })
    expect(calculateChange(25_000, 0)).toEqual({
        amountCents: 25_000,
        percentage: null,
    })
})

test("calculates assets, liabilities, and net worth from positive balances", () => {
    const snapshot = calculateSnapshot("2026-07-31", [
        {accountType: "asset", amountCents: 100_000, date: "2026-07-31"},
        {accountType: "asset", amountCents: 50_000, date: "2026-07-31"},
        {
            accountType: "liability",
            amountCents: 20_000,
            date: "2026-07-31",
        },
    ])

    expect(snapshot).toEqual({
        assetsCents: 150_000,
        date: "2026-07-31",
        liabilitiesCents: 20_000,
        netWorthCents: 130_000,
    })
})

test("returns zero totals for an empty snapshot", () => {
    expect(calculateSnapshot("2026-07-31", [])).toEqual({
        assetsCents: 0,
        date: "2026-07-31",
        liabilitiesCents: 0,
        netWorthCents: 0,
    })
})

test("groups balances into a chronological snapshot series", () => {
    const series = calculateSnapshotSeries([
        {accountType: "asset", amountCents: 80_000, date: "2026-07-31"},
        {accountType: "asset", amountCents: 50_000, date: "2026-07-24"},
        {
            accountType: "liability",
            amountCents: 10_000,
            date: "2026-07-31",
        },
        {
            accountType: "liability",
            amountCents: 20_000,
            date: "2026-07-24",
        },
    ])

    expect(series).toEqual([
        {
            assetsCents: 50_000,
            date: "2026-07-24",
            liabilitiesCents: 20_000,
            netWorthCents: 30_000,
        },
        {
            assetsCents: 80_000,
            date: "2026-07-31",
            liabilitiesCents: 10_000,
            netWorthCents: 70_000,
        },
    ])
})

test("selects the latest snapshot window", () => {
    const snapshots = [
        {
            assetsCents: 100,
            date: "2026-07-17",
            liabilitiesCents: 10,
            netWorthCents: 90,
        },
        {
            assetsCents: 110,
            date: "2026-07-24",
            liabilitiesCents: 10,
            netWorthCents: 100,
        },
        {
            assetsCents: 120,
            date: "2026-07-31",
            liabilitiesCents: 10,
            netWorthCents: 110,
        },
    ]

    expect(getSnapshotWindow(snapshots, 2)).toEqual(snapshots.slice(-2))
    expect(getSnapshotWindow(snapshots, "all")).toEqual(snapshots)
})

test("calculates a cumulative all-time spending average", () => {
    const startTime = Date.UTC(2025, 0, 1)
    const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000
    const captures = Array.from({length: 54}, (_, week) => {
        const date = new Date(startTime + week * weekInMilliseconds)
            .toISOString()
            .slice(0, 10)

        return {
            date,
            spendingCents: week < 52 ? 100_000 : 200_000,
        }
    })

    const trend = calculateSpendingTrend(captures)

    expect(trend[0]?.allTimeAverageCents).toEqual(100_000)
    expect(trend[51]?.allTimeAverageCents).toEqual(100_000)
    expect(trend[52]?.allTimeAverageCents).toEqual(101_887)
    expect(trend[53]?.allTimeAverageCents).toEqual(103_704)
})

test("calculates a capture summary and savings plan", () => {
    const summary = calculateCaptureSummary(
        [
            {
                accountCategory: "cash",
                accountName: "Checking",
                accountType: "asset",
                amountCents: 2_500_000,
            },
            {
                accountCategory: "savings",
                accountName: "Savings",
                accountType: "asset",
                amountCents: 1_000_000,
            },
            {
                accountCategory: "credit",
                accountName: "NFCU",
                accountType: "liability",
                amountCents: 100_000,
            },
            {
                accountCategory: "credit",
                accountName: "Apple",
                accountType: "liability",
                amountCents: 50_000,
            },
            {
                accountCategory: "mortgage",
                accountName: "Mortgage",
                accountType: "liability",
                amountCents: 10_000_000,
            },
        ],
        {
            checkingBaselineCents: 2_000_000,
            excessInvestPct: 75,
            excessSavePct: 25,
        },
    )

    expect(summary).toEqual({
        assetsCents: 3_500_000,
        availableCheckingCents: 2_350_000,
        checkingCents: 2_500_000,
        investmentsSavedCents: 262_500,
        liabilitiesCents: 10_150_000,
        netWorthCents: -6_650_000,
        savingsSavedCents: 87_500,
        spendingCents: 150_000,
        totalSavedCents: 350_000,
    })
})

test("does not recommend saving below the checking baseline", () => {
    const summary = calculateCaptureSummary(
        [
            {
                accountCategory: "cash",
                accountName: "Checking",
                accountType: "asset",
                amountCents: 2_050_000,
            },
            {
                accountCategory: "credit",
                accountName: "NFCU",
                accountType: "liability",
                amountCents: 100_000,
            },
        ],
        {
            checkingBaselineCents: 2_000_000,
            excessInvestPct: 75,
            excessSavePct: 25,
        },
    )

    expect(summary.availableCheckingCents).toEqual(1_950_000)
    expect(summary.totalSavedCents).toEqual(0)
    expect(summary.investmentsSavedCents).toEqual(0)
    expect(summary.savingsSavedCents).toEqual(0)
})
