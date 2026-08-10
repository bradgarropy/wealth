import {beforeEach, expect, test, vi} from "vitest"

const {database, getAllBalances, getDatabase, getSettings} = vi.hoisted(() => ({
    database: {},
    getAllBalances: vi.fn(),
    getDatabase: vi.fn(),
    getSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabase}))
vi.mock("~/db/queries", () => ({getAllBalances, getSettings}))

import {loader} from "~/routes/insights"

beforeEach(() => {
    vi.clearAllMocks()
    getDatabase.mockReturnValue(database)
    getSettings.mockResolvedValue({defaultWindow: 52})
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

    const result = await loader({
        context: {cloudflare: {env: {}}},
        params: {},
        request: new Request("http://localhost/insights"),
    } as Parameters<typeof loader>[0])

    expect(getDatabase).toHaveBeenCalledOnce()
    expect(getAllBalances).toHaveBeenCalledWith(database)
    expect(getSettings).toHaveBeenCalledWith(database)
    expect(result).toEqual({
        defaultWindow: 52,
        spending: [
            {
                date: "2026-07-17",
                spendingCents: 0,
                allTimeAverageCents: 0,
            },
            {
                date: "2026-07-31",
                spendingCents: 50_000,
                allTimeAverageCents: 25_000,
            },
            {
                date: "2026-08-07",
                spendingCents: 150_000,
                allTimeAverageCents: 66_667,
            },
        ],
    })
})
