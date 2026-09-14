import {beforeEach, expect, test, vi} from "vitest"

import {ACCOUNT} from "~/constants"
import {createRouteArguments} from "~/tests/route"

const {database, getAllBalances, getDatabaseFromContext, getSettings} =
    vi.hoisted(() => ({
        database: {},
        getAllBalances: vi.fn(),
        getDatabaseFromContext: vi.fn(),
        getSettings: vi.fn(),
    }))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({getAllBalances, getSettings}))

import {loader} from "~/routes/insights"

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
    getSettings.mockResolvedValue({
        checkingBaselineCents: 2_000_000,
        defaultWindow: 52,
        excessInvestPct: 75,
        excessSavePct: 25,
    })
})

test("loads weekly spending and its rolling average", async () => {
    getAllBalances.mockResolvedValue([
        {
            accountCategory: "credit",
            amountCents: 100_000,
            date: "2026-08-07",
        },
        {
            accountCategory: "credit",
            amountCents: 50_000,
            date: "2026-08-07",
        },
        {
            accountCategory: "cash",
            amountCents: 500_000,
            date: "2026-08-07",
        },
        {
            accountCategory: "credit",
            amountCents: 50_000,
            date: "2026-07-31",
        },
        {
            accountCategory: "cash",
            amountCents: 450_000,
            date: "2026-07-24",
        },
        {
            accountCategory: "credit",
            amountCents: 0,
            date: "2026-07-17",
        },
    ])

    const request = new Request("http://localhost/insights")
    const result = await loader({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof loader>[0])

    expect(getDatabaseFromContext).toHaveBeenCalledOnce()
    expect(getAllBalances).toHaveBeenCalledWith(database)
    expect(getSettings).toHaveBeenCalledWith(database)
    expect(result.defaultWindow).toBe(52)
    expect(result.snapshots).toHaveLength(4)
    expect(result.spending).toEqual([
        {
            date: "2026-07-17",
            spendingCents: 0,
            allTimeAverageCents: 0,
            fiftyTwoWeekAverageCents: null,
            twelveWeekAverageCents: null,
        },
        {
            date: "2026-07-31",
            spendingCents: 50_000,
            allTimeAverageCents: 25_000,
            fiftyTwoWeekAverageCents: null,
            twelveWeekAverageCents: null,
        },
        {
            date: "2026-08-07",
            spendingCents: 150_000,
            allTimeAverageCents: 66_667,
            fiftyTwoWeekAverageCents: null,
            twelveWeekAverageCents: null,
        },
    ])
})

test("loads savings only on the historical allowlist and from 2026 onward", async () => {
    const balance = (
        date: string,
        accountName: string,
        accountCategory: "cash" | "credit",
        amountCents: number,
    ) => ({
        accountCategory,
        accountName,
        accountType: accountCategory === "cash" ? "asset" : "liability",
        amountCents,
        date,
    })

    getAllBalances.mockResolvedValue([
        balance("2025-08-15", ACCOUNT.CHECKING, "cash", 2_100_000),
        balance("2025-09-15", ACCOUNT.CHECKING, "cash", 2_100_000),
        balance("2025-09-21", ACCOUNT.CHECKING, "cash", 2_100_000),
        balance("2026-01-01", ACCOUNT.CHECKING, "cash", 2_000_000),
    ])

    const request = new Request("http://localhost/insights")
    const result = await loader({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof loader>[0])

    expect(result.savings).toEqual([
        {
            date: "2025-09-15",
            investmentsSavedCents: 75_000,
            savingsSavedCents: 25_000,
            totalSavedCents: 100_000,
        },
        {
            date: "2026-01-01",
            investmentsSavedCents: 0,
            savingsSavedCents: 0,
            totalSavedCents: 0,
        },
    ])
    expect(result.savingsRate).toEqual([])
})
