import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {createRoutesStub} from "react-router"
import {expect, test} from "vitest"

import {ACCOUNT} from "~/constants"
import type {Account} from "~/db/queries"
import Route from "~/routes/capture"
import {formatDateInput} from "~/utils/format"

type CaptureAccount = Pick<Account, "category" | "id" | "name" | "type"> & {
    defaultAmountCents: number | null
}

const accounts: CaptureAccount[] = [
    {
        category: "cash" as const,
        defaultAmountCents: null,
        id: 1,
        name: ACCOUNT.CHECKING,
        type: "asset" as const,
    },
    {
        category: "credit" as const,
        defaultAmountCents: null,
        id: 2,
        name: "Apple",
        type: "liability" as const,
    },
]

const renderRoute = (routeAccounts: CaptureAccount[] = accounts) => {
    const Stub = createRoutesStub([
        {
            action: async ({request}) => {
                const formData = await request.formData()

                return {date: String(formData.get("date")), error: null}
            },
            Component: Route,
            loader: () => ({
                accounts: routeAccounts,
                settings: {
                    checkingBaselineCents: 100_000,
                    defaultWindow: 52 as const,
                    emergencyBaselineCents: 6_000_000,
                    excessInvestPct: 75,
                    excessSavePct: 25,
                    id: 1,
                },
            }),
            path: "/capture",
        },
        {
            Component: () => null,
            path: "/capture/:date",
        },
    ])

    render(<Stub initialEntries={["/capture"]} />)
}

test("renders the date step", async () => {
    const user = userEvent.setup()
    renderRoute()

    expect(
        await screen.findByRole("heading", {
            name: "When are these balances from?",
        }),
    ).toBeInTheDocument()
    expect(document.title).toEqual("wealth | capture")
    expect(screen.getByText("1 of 7")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuetext",
        "Step 1 of 7",
    )
    expect(screen.getByText("Balance date")).toHaveClass("text-right")
    const datePicker = screen.getByLabelText("Balance date")

    expect(datePicker).toHaveClass("text-right")
    expect(datePicker).toHaveAttribute("type", "button")
    expect(
        screen.getByRole("button", {name: "Begin capture"}),
    ).toBeInTheDocument()

    await user.click(datePicker)

    expect(screen.getByRole("grid")).toBeInTheDocument()
})

test("walks through accounts and preserves their balances", async () => {
    const user = userEvent.setup()
    renderRoute()

    await user.click(await screen.findByRole("button", {name: "Begin capture"}))

    expect(
        screen.getByRole("heading", {
            name: "What is the current balance?",
        }),
    ).toBeInTheDocument()
    expect(screen.getByText(ACCOUNT.CHECKING)).toBeInTheDocument()
    expect(screen.getByText("cash")).toBeInTheDocument()
    expect(screen.getByText("asset")).toBeInTheDocument()
    expect(screen.getByText("2 of 7")).toBeInTheDocument()

    const checkingInput = screen.getByLabelText("Current balance")
    const nextButton = screen.getByRole("button", {name: "Next account"})

    expect(checkingInput).toHaveValue("")
    expect(nextButton).toBeDisabled()

    await user.type(checkingInput, "1300")
    expect(nextButton).toBeEnabled()
    await user.click(nextButton)

    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.getByText("credit")).toBeInTheDocument()
    expect(screen.getByText("liability")).toBeInTheDocument()
    expect(screen.getByText("3 of 7")).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("")
    const confirmButton = screen.getByRole("button", {
        name: "Confirm balances",
    })

    expect(confirmButton).toBeDisabled()

    await user.type(screen.getByLabelText("Current balance"), "42")
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    expect(
        screen.getByRole("heading", {name: "Confirm balances"}),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", {name: "Assets"})).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {name: "Liabilities"}),
    ).toBeInTheDocument()
    expect(screen.getByText("$1,300.00")).toBeInTheDocument()
    expect(screen.getByText("$42.00")).toBeInTheDocument()
    expect(screen.getByText("4 of 7")).toBeInTheDocument()
    expect(
        screen.getByRole("button", {name: "Confirm and continue"}),
    ).toBeEnabled()

    await user.click(screen.getByRole("button", {name: "Back"}))

    expect(screen.getByText("Apple")).toBeInTheDocument()

    await user.click(screen.getByRole("button", {name: "Back"}))

    expect(screen.getByText(ACCOUNT.CHECKING)).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("1,300.00")
})

test("advances account steps with Enter only after entering a balance", async () => {
    const user = userEvent.setup()
    renderRoute()

    await user.click(await screen.findByRole("button", {name: "Begin capture"}))

    const checkingInput = screen.getByLabelText("Current balance")

    expect(checkingInput).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(screen.getByText(ACCOUNT.CHECKING)).toBeInTheDocument()

    await user.type(checkingInput, "1300")
    await user.keyboard("{Enter}")

    expect(screen.getByText("Apple")).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("")
    expect(screen.getByLabelText("Current balance")).toHaveFocus()
})

test("continues from saved balances through the weekly workflow", async () => {
    const user = userEvent.setup()
    const expectedDate = formatDateInput(new Date())
    renderRoute()

    await user.click(await screen.findByRole("button", {name: "Begin capture"}))
    await user.type(screen.getByLabelText("Current balance"), "1300")
    await user.click(screen.getByRole("button", {name: "Next account"}))
    await user.type(screen.getByLabelText("Current balance"), "42")
    await user.click(screen.getByRole("button", {name: "Confirm balances"}))
    await user.click(screen.getByRole("button", {name: "Confirm and continue"}))

    expect(
        await screen.findByRole("heading", {
            name: "Pay off your credit cards",
        }),
    ).toBeInTheDocument()
    expect(screen.getByText("5 of 7")).toBeInTheDocument()

    const continueButton = screen.getByRole("button", {name: "Continue"})

    expect(continueButton).toBeDisabled()
    await user.click(screen.getByRole("checkbox", {name: /Apple/}))
    expect(continueButton).toBeEnabled()
    await user.click(continueButton)

    expect(
        screen.getByRole("heading", {name: "Move your excess cash"}),
    ).toBeInTheDocument()
    expect(screen.getByText("6 of 7")).toBeInTheDocument()
    expect(screen.getByText("$193.50")).toBeInTheDocument()
    expect(screen.getByText("$64.50")).toBeInTheDocument()

    const finishButton = screen.getByRole("button", {name: "Finish"})
    const investmentCheckbox = screen.getByRole("checkbox", {
        name: /Investments/,
    })

    await user.click(
        screen.getByRole("button", {
            name: "Copy $193.50 transfer to Investments",
        }),
    )

    expect(await navigator.clipboard.readText()).toBe("193.50")
    expect(screen.getByText("$193.50 copied")).toBeInTheDocument()
    expect(investmentCheckbox).not.toBeChecked()

    expect(finishButton).toBeDisabled()
    await user.click(investmentCheckbox)
    await user.click(screen.getByRole("checkbox", {name: /Savings/}))
    expect(finishButton).toBeEnabled()
    await user.click(finishButton)

    expect(
        screen.getByRole("heading", {name: "Weekly finances complete"}),
    ).toBeInTheDocument()
    expect(screen.getByText("7 of 7")).toBeInTheDocument()
    expect(screen.queryByText("Cards paid")).not.toBeInTheDocument()
    expect(
        screen.getByRole("link", {name: "View capture summary"}),
    ).toHaveAttribute("href", `/capture/${expectedDate}`)
})

test("does not create a payoff task for a zero credit balance", async () => {
    const user = userEvent.setup()
    renderRoute()

    await user.click(await screen.findByRole("button", {name: "Begin capture"}))
    await user.type(screen.getByLabelText("Current balance"), "1000")
    await user.click(screen.getByRole("button", {name: "Next account"}))
    await user.type(screen.getByLabelText("Current balance"), "0")
    await user.click(screen.getByRole("button", {name: "Confirm balances"}))
    await user.click(screen.getByRole("button", {name: "Confirm and continue"}))

    expect(
        await screen.findByRole("heading", {
            name: "Pay off your credit cards",
        }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Apple")).not.toBeInTheDocument()
    expect(screen.getByText("No card payments this week.")).toBeInTheDocument()
    expect(screen.getByRole("button", {name: "Continue"})).toBeEnabled()
})

test("carries the emergency and mortgage balances forward", async () => {
    const user = userEvent.setup()

    renderRoute([
        {
            category: "savings",
            defaultAmountCents: 6_000_000,
            id: 3,
            name: ACCOUNT.EMERGENCY,
            type: "asset",
        },
        {
            category: "mortgage",
            defaultAmountCents: 18_000_000,
            id: 4,
            name: "Mortgage",
            type: "liability",
        },
    ])

    await user.click(await screen.findByRole("button", {name: "Begin capture"}))

    expect(screen.getByText(ACCOUNT.EMERGENCY)).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("60,000.00")

    await user.click(screen.getByRole("button", {name: "Next account"}))

    expect(screen.getByText("Mortgage")).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("180,000.00")
})
