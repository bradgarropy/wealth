import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {database, getDatabaseFromContext, getSettings} = vi.hoisted(() => ({
    database: {},
    getDatabaseFromContext: vi.fn(),
    getSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({getSettings, setSettings: vi.fn()}))

import {loader} from "~/routes/settings"

const settings = {
    checkingBaselineCents: 2_000_000,
    defaultWindow: 52,
    emergencyBaselineCents: 6_000_000,
    excessInvestPct: 75,
    excessSavePct: 25,
    id: 1,
}

const callLoader = () => {
    const request = new Request("http://localhost/settings")

    return loader({
        ...createRouteArguments(request),
        params: {},
    } as Parameters<typeof loader>[0])
}

beforeEach(() => {
    vi.clearAllMocks()
    getDatabaseFromContext.mockReturnValue(database)
    getSettings.mockResolvedValue(settings)
})

test("loads the app settings", async () => {
    await expect(callLoader()).resolves.toEqual({settings})
    expect(getSettings).toHaveBeenCalledWith(database)
})

test("fails clearly when settings are not configured", async () => {
    getSettings.mockResolvedValue(null)

    await expect(callLoader()).rejects.toMatchObject({init: {status: 500}})
})
