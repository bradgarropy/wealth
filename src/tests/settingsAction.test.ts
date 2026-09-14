import {beforeEach, expect, test, vi} from "vitest"

import {createRouteArguments} from "~/tests/route"

const {database, getDatabaseFromContext, setSettings} = vi.hoisted(() => ({
    database: {},
    getDatabaseFromContext: vi.fn(),
    setSettings: vi.fn(),
}))

vi.mock("~/db/client", () => ({getDatabaseFromContext}))
vi.mock("~/db/queries", () => ({
    getSettings: vi.fn(),
    setSettings,
}))

import {action} from "~/routes/settings"

const createRequest = (values: Record<string, string>) => {
    const formData = new FormData()

    Object.entries(values).forEach(([key, value]) => formData.set(key, value))

    return new Request("http://localhost/settings", {
        body: formData,
        method: "POST",
    })
}

const validSettings = {
    checkingBaselineCents: "20000.25",
    defaultWindow: "52",
    emergencyBaselineCents: "60000",
    excessInvestPct: "75",
    excessSavePct: "25",
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
})

test("converts dollars to cents and saves valid settings", async () => {
    const result = await callAction(validSettings)

    expect(setSettings).toHaveBeenCalledWith(database, {
        checkingBaselineCents: 2_000_025,
        defaultWindow: 52,
        emergencyBaselineCents: 6_000_000,
        excessInvestPct: 75,
        excessSavePct: 25,
    })
    expect(result).toEqual({error: null, ok: true})
})

test("rejects a savings split that does not total 100%", async () => {
    const result = await callAction({
        ...validSettings,
        excessInvestPct: "80",
    })

    expect(result).toMatchObject({
        data: {
            error: "Check the settings and make sure the savings split totals 100%.",
            ok: false,
        },
        init: {status: 400},
    })
    expect(setSettings).not.toHaveBeenCalled()
})

test("rejects invalid money and reporting values", async () => {
    const result = await callAction({
        ...validSettings,
        checkingBaselineCents: "20.001",
        defaultWindow: "13",
    })

    expect(result).toMatchObject({init: {status: 400}})
    expect(setSettings).not.toHaveBeenCalled()
})

test("returns an error when settings cannot be saved", async () => {
    setSettings.mockRejectedValue(new Error("D1 write failed"))

    const result = await callAction(validSettings)

    expect(result).toMatchObject({
        data: {error: "Unable to save settings. Try again.", ok: false},
        init: {status: 500},
    })
})
