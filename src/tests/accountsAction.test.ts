import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {
    archiveAccount,
    createAccount,
    database,
    deleteAccount,
    getDatabaseFromContext,
    unarchiveAccount,
    updateAccount,
} = vi.hoisted(() => ({
    archiveAccount: vi.fn(),
    createAccount: vi.fn(),
    database: {},
    deleteAccount: vi.fn(),
    getDatabaseFromContext: vi.fn(),
    unarchiveAccount: vi.fn(),
    updateAccount: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({
    archiveAccount,
    createAccount,
    deleteAccount,
    getAccounts: vi.fn(),
    unarchiveAccount,
    updateAccount,
}))

import {action} from "~/routes/accounts"

const createRequest = (values: Record<string, string>) => {
    const formData = new FormData()

    Object.entries(values).forEach(([key, value]) => formData.set(key, value))

    return new Request("http://localhost/accounts", {
        body: formData,
        method: "POST",
    })
}

const callAction = (values: Record<string, string>) => {
    const request = createRequest(values)

    return action({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof action>[0])
}

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
    deleteAccount.mockResolvedValue(true)
})

test("creates an account", async () => {
    const result = await callAction({
        category: "cash",
        intent: "create",
        name: "Brokerage",
        type: "asset",
    })

    expect(createAccount).toHaveBeenCalledWith(database, {
        category: "cash",
        name: "Brokerage",
        type: "asset",
    })
    expect(result).toEqual({ok: true})
})

test("updates an account", async () => {
    await callAction({
        category: "investment",
        id: "7",
        intent: "update",
        name: "Brokerage",
        type: "asset",
    })

    expect(updateAccount).toHaveBeenCalledWith(database, 7, {
        category: "investment",
        name: "Brokerage",
        type: "asset",
    })
})

test("archives an account", async () => {
    await callAction({id: "7", intent: "archive"})

    expect(archiveAccount).toHaveBeenCalledWith(database, 7)
})

test("unarchives an account", async () => {
    await callAction({id: "7", intent: "unarchive"})

    expect(unarchiveAccount).toHaveBeenCalledWith(database, 7)
})

test("deletes an account without balance history", async () => {
    await callAction({id: "7", intent: "delete"})

    expect(deleteAccount).toHaveBeenCalledWith(database, 7)
})

test("rejects deletion when an account has balance history", async () => {
    deleteAccount.mockResolvedValue(false)

    const result = await callAction({id: "7", intent: "delete"})

    expect(result).toMatchObject({
        data: {
            error: "Accounts with balance history cannot be deleted. Archive this account instead.",
        },
        init: {status: 409},
    })
})

test("rejects invalid account details", async () => {
    const result = await callAction({
        category: "cash",
        intent: "create",
        name: "",
        type: "asset",
    })

    expect(result).toMatchObject({
        data: {error: "Check the account details and try again."},
        init: {status: 400},
    })
    expect(createAccount).not.toHaveBeenCalled()
})

test("returns a useful error when a write fails", async () => {
    createAccount.mockRejectedValue(new Error("unique constraint"))

    const result = await callAction({
        category: "cash",
        intent: "create",
        name: "Checking",
        type: "asset",
    })

    expect(result).toMatchObject({
        data: {
            error: "Unable to save the account. Account names must be unique.",
        },
        init: {status: 409},
    })
})
