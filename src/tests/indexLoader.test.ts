import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {
    database,
    getAccounts,
    getAllBalances,
    getDatabaseFromContext,
    getSettings,
} = vi.hoisted(() => ({
    database: {},
    getAccounts: vi.fn(),
    getAllBalances: vi.fn(),
    getDatabaseFromContext: vi.fn(),
    getSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({getAccounts, getAllBalances, getSettings}))

import {loader} from "~/routes/index"

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
})

test("loads balance history and derives financial snapshots", async () => {
    getSettings.mockResolvedValue({defaultWindow: 52})
    getAccounts.mockResolvedValue([
        {
            archived: false,
            id: 1,
            name: "Checking",
            type: "asset",
        },
        {
            archived: false,
            id: 2,
            name: "NFCU",
            type: "liability",
        },
        {
            archived: true,
            id: 3,
            name: "Apple",
            type: "liability",
        },
        {
            archived: false,
            id: 4,
            name: "New savings",
            type: "asset",
        },
    ])
    getAllBalances.mockResolvedValue([
        {
            accountId: 1,
            accountType: "asset",
            amountCents: 125_000,
            date: "2026-07-31",
        },
        {
            accountId: 2,
            accountType: "liability",
            amountCents: 20_000,
            date: "2026-07-31",
        },
        {
            accountId: 3,
            accountType: "liability",
            amountCents: 0,
            date: "2026-07-31",
        },
    ])

    const request = new Request("http://localhost/")
    const result = await loader({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof loader>[0])

    expect(getDatabaseFromContext).toHaveBeenCalledOnce()
    expect(getAccounts).toHaveBeenCalledWith(database)
    expect(getAllBalances).toHaveBeenCalledWith(database)
    expect(getSettings).toHaveBeenCalledWith(database)
    expect(result).toEqual({
        defaultWindow: 52,
        latestBalances: [
            {
                accountId: 1,
                accountName: "Checking",
                accountType: "asset",
                amountCents: 125_000,
            },
            {
                accountId: 2,
                accountName: "NFCU",
                accountType: "liability",
                amountCents: 20_000,
            },
            {
                accountId: 4,
                accountName: "New savings",
                accountType: "asset",
                amountCents: null,
            },
        ],
        snapshots: [
            {
                assetsCents: 125_000,
                date: "2026-07-31",
                liabilitiesCents: 20_000,
                netWorthCents: 105_000,
            },
        ],
    })
})
