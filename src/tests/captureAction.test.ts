import {beforeEach, describe, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {database, getDatabaseFromContext, upsertBalances} = vi.hoisted(() => ({
    database: {},
    getDatabaseFromContext: vi.fn(),
    upsertBalances: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({
    getAccounts: vi.fn(),
    getLatestBalances: vi.fn(),
    upsertBalances,
}))

import {action} from "~/routes/capture"

const createRequest = (date: string, balances: unknown) => {
    const formData = new FormData()

    formData.set("date", date)
    formData.set("balances", JSON.stringify(balances))

    return new Request("http://localhost/capture", {
        body: formData,
        method: "POST",
    })
}

const callAction = (request: Request) => {
    return action({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof action>[0])
}

beforeEach(() => {
    getDatabaseFromContext.mockReturnValue(database)
    upsertBalances.mockReset()
})

test("upserts a valid balance snapshot for the remaining capture flow", async () => {
    const balances = [
        {accountId: 1, amountCents: 123_456},
        {accountId: 2, amountCents: 0},
    ]

    const response = await callAction(createRequest("2026-07-27", balances))

    expect(getDatabaseFromContext).toHaveBeenCalledOnce()
    expect(upsertBalances).toHaveBeenCalledWith(
        database,
        "2026-07-27",
        balances,
    )
    expect(response).toEqual({date: "2026-07-27", error: null})
})

describe.each([
    ["an invalid date", "07/27/2026", [{accountId: 1, amountCents: 100}]],
    ["no balances", "2026-07-27", []],
    ["an invalid balance", "2026-07-27", [{accountId: 1, amountCents: -1}]],
    [
        "duplicate accounts",
        "2026-07-27",
        [
            {accountId: 1, amountCents: 100},
            {accountId: 1, amountCents: 200},
        ],
    ],
])("rejects %s", (_, date, balances) => {
    test("without writing to D1", async () => {
        const response = await callAction(createRequest(date, balances))

        expect(response).toMatchObject({
            data: {error: "Check the date and balances, then try again."},
            init: {status: 400},
        })
        expect(upsertBalances).not.toHaveBeenCalled()
    })
})
