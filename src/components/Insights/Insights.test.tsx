import {render, screen} from "@testing-library/react"
import {MemoryRouter} from "react-router"
import {expect, test} from "vitest"

import Insights from "~/components/Insights"

test("renders the spending graph", () => {
    render(
        <MemoryRouter>
            <Insights
                defaultWindow={52}
                savings={[
                    {
                        date: "2026-08-07",
                        investmentsSavedCents: 300_000,
                        savingsSavedCents: 100_000,
                        totalSavedCents: 400_000,
                    },
                ]}
                savingsRate={[
                    {
                        allTimeRate: 0.7,
                        date: "2026-08-07",
                        fiftyTwoWeekRate: null,
                        twelveWeekRate: 0.8,
                    },
                ]}
                spending={[
                    {
                        date: "2026-08-07",
                        spendingCents: 100_000,
                        allTimeAverageCents: 90_000,
                        fiftyTwoWeekAverageCents: 85_000,
                        twelveWeekAverageCents: 95_000,
                    },
                ]}
            />
        </MemoryRouter>,
    )

    expect(screen.getByRole("heading", {name: "Insights"})).toBeInTheDocument()
    expect(screen.getByRole("link", {name: "August 7, 2026"})).toHaveAttribute(
        "href",
        "/capture/2026-08-07",
    )
    expect(screen.getByRole("heading", {name: "Spending"})).toBeInTheDocument()
    expect(
        screen.getByRole("img", {
            name: "Weekly spending over time",
        }),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("img", {
            name: "Twelve-week, fifty-two-week, and all-time spending averages over time",
        }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", {name: "Savings"})).toBeInTheDocument()
    expect(
        screen.getByRole("img", {name: "Weekly savings over time"}),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("img", {
            name: "Twelve-week, fifty-two-week, and all-time savings rates over time",
        }),
    ).toBeInTheDocument()
})

test("renders an empty state", () => {
    render(
        <MemoryRouter>
            <Insights
                defaultWindow={52}
                savings={[]}
                savingsRate={[]}
                spending={[]}
            />
        </MemoryRouter>,
    )

    expect(screen.getByText("No balance snapshots yet.")).toBeInTheDocument()
})
