import {render, screen, within} from "@testing-library/react"
import {createRoutesStub} from "react-router"
import {expect, test} from "vitest"

import {ACCOUNT} from "~/constants"
import Route from "~/routes/capture-summary"

const renderRoute = () => {
    const Stub = createRoutesStub([
        {
            Component: Route,
            loader: () => ({
                balances: [
                    {
                        accountCategory: "cash",
                        accountId: 1,
                        accountName: ACCOUNT.CHECKING,
                        accountSortOrder: 10,
                        accountType: "asset",
                        amountCents: 2_500_000,
                        date: "2026-07-27",
                        id: 1,
                    },
                    {
                        accountCategory: "savings",
                        accountId: 2,
                        accountName: ACCOUNT.SAVINGS,
                        accountSortOrder: 20,
                        accountType: "asset",
                        amountCents: 1_000_000,
                        date: "2026-07-27",
                        id: 2,
                    },
                    {
                        accountCategory: "credit",
                        accountId: 3,
                        accountName: "NFCU",
                        accountSortOrder: 30,
                        accountType: "liability",
                        amountCents: 100_000,
                        date: "2026-07-27",
                        id: 3,
                    },
                    {
                        accountCategory: "credit",
                        accountId: 4,
                        accountName: "Apple",
                        accountSortOrder: 40,
                        accountType: "liability",
                        amountCents: 0,
                        date: "2026-07-27",
                        id: 4,
                    },
                    {
                        accountCategory: "mortgage",
                        accountId: 5,
                        accountName: "Mortgage",
                        accountSortOrder: 50,
                        accountType: "liability",
                        amountCents: 10_000_000,
                        date: "2026-07-27",
                        id: 5,
                    },
                    {
                        accountCategory: "investment",
                        accountId: 6,
                        accountName: ACCOUNT.INVESTMENT,
                        accountSortOrder: 60,
                        accountType: "asset",
                        amountCents: 0,
                        date: "2026-07-27",
                        id: 6,
                    },
                ],
                date: "2026-07-27",
                nextDate: "2026-08-03",
                previousDate: "2026-07-20",
                summary: {
                    assetsCents: 3_500_000,
                    availableCheckingCents: 2_400_000,
                    checkingCents: 2_500_000,
                    investmentsSavedCents: 300_000,
                    liabilitiesCents: 10_100_000,
                    netWorthCents: -6_600_000,
                    savingsSavedCents: 100_000,
                    spendingCents: 100_000,
                    totalSavedCents: 400_000,
                },
            }),
            path: "/capture/:date",
        },
        {
            Component: () => null,
            path: "/capture",
        },
    ])

    render(<Stub initialEntries={["/capture/2026-07-27"]} />)
}

test("renders the captured balances, spending, and savings summary", async () => {
    renderRoute()

    expect(
        await screen.findByRole("heading", {name: "Capture summary"}),
    ).toBeInTheDocument()
    expect(document.title).toEqual("wealth | capture summary")
    expect(screen.getByText("July 27, 2026")).toBeInTheDocument()
    expect(screen.getByRole("link", {name: "New capture"})).toHaveAttribute(
        "href",
        "/capture",
    )
    expect(
        screen.getByRole("link", {
            name: "Previous capture: July 20, 2026",
        }),
    ).toHaveAttribute("href", "/capture/2026-07-20")
    expect(
        screen.getByRole("link", {name: "Next capture: August 3, 2026"}),
    ).toHaveAttribute("href", "/capture/2026-08-03")

    const totals = screen.getByRole("region", {
        name: "Financial snapshot totals",
    })

    expect(totals).toHaveTextContent("Assets$35,000.00")
    expect(totals).toHaveTextContent("Liabilities$101,000.00")
    expect(totals).toHaveTextContent("Net worth-$66,000.00")

    const balances = screen.getByRole("region", {name: "Balances"})
    const cashFlowTotals = screen.getByRole("region", {
        name: "Cash flow totals",
    })
    const spent = screen.getByRole("region", {
        name: "Spending breakdown",
    })
    const saved = screen.getByRole("region", {
        name: "Savings breakdown",
    })

    expect(cashFlowTotals).toHaveTextContent("Spent$1,000.00")
    expect(cashFlowTotals).toHaveTextContent("Saved$4,000.00")
    expect(within(balances).getByText(ACCOUNT.CHECKING)).toBeInTheDocument()
    expect(within(balances).getByText("Mortgage")).toBeInTheDocument()
    expect(within(balances).getByText("Apple")).toBeInTheDocument()
    expect(
        within(balances).getByRole("link", {name: ACCOUNT.CHECKING}),
    ).toHaveAttribute("href", "/account/1")
    expect(
        within(balances).getByRole("link", {name: "Mortgage"}),
    ).toHaveAttribute("href", "/account/5")
    expect(
        within(balances).getByText("Cash, savings, and investments."),
    ).toBeInTheDocument()
    expect(
        within(balances).getByText("Credit cards and outstanding loans."),
    ).toBeInTheDocument()
    expect(within(balances).queryByText("Total")).not.toBeInTheDocument()
    expect(within(spent).getByText("NFCU")).toBeInTheDocument()
    expect(within(spent).getByRole("link", {name: "NFCU"})).toHaveAttribute(
        "href",
        "/account/3",
    )
    expect(within(spent).queryByText("Apple")).not.toBeInTheDocument()
    expect(within(spent).getByText("$1,000.00")).toBeInTheDocument()
    expect(within(saved).getByText("Investments")).toBeInTheDocument()
    expect(
        within(saved).getByRole("link", {name: "Investments"}),
    ).toHaveAttribute("href", "/account/6")
    expect(within(saved).queryByText("75%")).not.toBeInTheDocument()
    expect(within(saved).getByText("Savings")).toBeInTheDocument()
    expect(within(saved).getByRole("link", {name: "Savings"})).toHaveAttribute(
        "href",
        "/account/2",
    )
    expect(within(saved).queryByText("25%")).not.toBeInTheDocument()
    expect(
        within(saved).queryByText("Checking after cards"),
    ).not.toBeInTheDocument()
    expect(within(saved).queryByText("Total saved")).not.toBeInTheDocument()
})
