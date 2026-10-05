import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {
    database,
    getAccounts,
    getDatabaseFromContext,
    getLatestBalances,
    getSettings,
} = vi.hoisted(() => ({
    database: {},
    getAccounts: vi.fn(),
    getDatabaseFromContext: vi.fn(),
    getLatestBalances: vi.fn(),
    getSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({
    getAccounts,
    getLatestBalances,
    getSettings,
    upsertBalances: vi.fn(),
}))

import {loader} from "~/routes/capture"

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
    getSettings.mockResolvedValue({
        checkingBaselineCents: 100_000,
        defaultWindow: 52,
        emergencyBaselineCents: 6_000_000,
        excessInvestPct: 75,
        excessSavePct: 25,
        id: 1,
    })
})

test("provides the previous balance as a placeholder for every active account", async () => {
    getAccounts.mockResolvedValue([
        {
            archived: false,
            category: "cash",
            id: 1,
            name: "Checking",
            type: "asset",
        },
        {
            archived: false,
            category: "mortgage",
            id: 2,
            name: "Mortgage",
            type: "liability",
        },
    ])
    getLatestBalances.mockResolvedValue([
        {accountId: 1, amountCents: 1_000_000},
        {accountId: 2, amountCents: 18_000_000},
    ])

    const request = new Request("http://localhost/capture")
    const result = await loader({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof loader>[0])

    expect(result.accounts).toEqual([
        {
            category: "cash",
            id: 1,
            name: "Checking",
            previousValue: 10_000,
            type: "asset",
        },
        {
            category: "mortgage",
            id: 2,
            name: "Mortgage",
            previousValue: 180_000,
            type: "liability",
        },
    ])
})
