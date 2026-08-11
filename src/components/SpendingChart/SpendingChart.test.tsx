import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {expect, test} from "vitest"

import {SpendingChart} from "~/components/SpendingChart"

test("renders spending and its trend averages across history ranges", async () => {
    const user = userEvent.setup()
    const {container} = render(
        <SpendingChart
            defaultWindow={4}
            points={[
                {
                    date: "2026-07-24",
                    spendingCents: 100_000,
                    allTimeAverageCents: 100_000,
                    fiftyTwoWeekAverageCents: 90_000,
                    twelveWeekAverageCents: 110_000,
                },
                {
                    date: "2026-07-31",
                    spendingCents: 125_000,
                    allTimeAverageCents: 112_500,
                    fiftyTwoWeekAverageCents: 95_000,
                    twelveWeekAverageCents: 115_000,
                },
            ]}
        />,
    )

    expect(
        screen.getByRole("img", {
            name: "Weekly spending over time",
        }),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {name: "Weekly spending"}),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {name: "Recent spending trends"}),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Latest difference/)).not.toBeInTheDocument()
    expect(
        screen.getByRole("img", {
            name: "Twelve-week, fifty-two-week, and all-time spending averages over time",
        }),
    ).toBeInTheDocument()
    expect(
        container.querySelectorAll('[data-legend-style="dashed"]'),
    ).toHaveLength(1)
    expect(
        container.querySelectorAll('[data-legend-style="solid"]'),
    ).toHaveLength(2)
    expect(screen.getByRole("button", {name: "Show 4 weeks"})).toHaveAttribute(
        "aria-pressed",
        "true",
    )

    await user.click(screen.getByRole("button", {name: "Show all history"}))

    expect(
        screen.getByRole("button", {name: "Show all history"}),
    ).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(1)
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(3)
})
