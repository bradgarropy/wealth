import {render, screen} from "@testing-library/react"
import {MemoryRouter} from "react-router"
import {expect, test} from "vitest"

import Insights from "~/components/Insights"

test("renders the spending graph", () => {
    render(
        <MemoryRouter>
            <Insights
                defaultWindow={52}
                spending={[
                    {
                        date: "2026-08-07",
                        spendingCents: 100_000,
                        allTimeAverageCents: 90_000,
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
            name: "All-time spending average over time",
        }),
    ).toBeInTheDocument()
})

test("renders an empty state", () => {
    render(
        <MemoryRouter>
            <Insights defaultWindow={52} spending={[]} />
        </MemoryRouter>,
    )

    expect(screen.getByText("No balance snapshots yet.")).toBeInTheDocument()
})
