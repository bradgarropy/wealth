import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {
    database,
    getAccount,
    getBalancesByAccountId,
    getDatabaseFromContext,
    getSettings,
} = vi.hoisted(() => ({
    database: {},
    getAccount: vi.fn(),
    getBalancesByAccountId: vi.fn(),
    getDatabaseFromContext: vi.fn(),
    getSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({
    getAccount,
    getBalancesByAccountId,
    getSettings,
}))

import {loader} from "~/routes/account-summary"

const account = {
    archived: false,
    category: "cash" as const,
    id: 1,
    name: "Checking",
    sortOrder: 10,
    type: "asset" as const,
}

const balances = [
    {
        accountId: 1,
        amountCents: 2_000_000,
        date: "2026-08-03",
        id: 1,
    },
]

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
    getAccount.mockResolvedValue(account)
    getBalancesByAccountId.mockResolvedValue(balances)
    getSettings.mockResolvedValue({defaultWindow: 52})
})

test("loads an account and its balance history", async () => {
    const request = new Request("http://localhost/account/1")
    const result = await loader({
        ...createRouteArguments(request),
        params: {accountId: "1"},
    } as Parameters<typeof loader>[0])

    expect(getDatabaseFromContext).toHaveBeenCalledOnce()
    expect(getAccount).toHaveBeenCalledWith(database, 1)
    expect(getBalancesByAccountId).toHaveBeenCalledWith(database, 1)
    expect(getSettings).toHaveBeenCalledWith(database)
    expect(result).toEqual({account, balances, defaultWindow: 52})
})

test("rejects an invalid account id before querying D1", async () => {
    await expect(
        loader({
            ...createRouteArguments(
                new Request("http://localhost/account/checking"),
            ),
            params: {accountId: "checking"},
        } as Parameters<typeof loader>[0]),
    ).rejects.toMatchObject({init: {status: 400}})

    expect(getDatabaseFromContext).not.toHaveBeenCalled()
})

test("returns not found for an unknown account", async () => {
    getAccount.mockResolvedValue(null)

    await expect(
        loader({
            ...createRouteArguments(new Request("http://localhost/account/99")),
            params: {accountId: "99"},
        } as Parameters<typeof loader>[0]),
    ).rejects.toMatchObject({init: {status: 404}})
})
