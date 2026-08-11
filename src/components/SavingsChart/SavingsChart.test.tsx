import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {expect, test} from "vitest"

import {SavingsChart} from "~/components/SavingsChart"

test("renders weekly savings and rate trends across history ranges", async () => {
    const user = userEvent.setup()
    const {container} = render(
        <SavingsChart
            defaultWindow={4}
            points={[
                {
                    date: "2026-07-24",
                    investmentsSavedCents: 300_000,
                    savingsSavedCents: 100_000,
                    totalSavedCents: 400_000,
                },
                {
                    date: "2026-07-31",
                    investmentsSavedCents: 0,
                    savingsSavedCents: 0,
                    totalSavedCents: 0,
                },
            ]}
            ratePoints={[
                {
                    allTimeRate: 0.7,
                    date: "2026-07-24",
                    fiftyTwoWeekRate: null,
                    twelveWeekRate: 0.8,
                },
                {
                    allTimeRate: 0.71,
                    date: "2026-07-31",
                    fiftyTwoWeekRate: null,
                    twelveWeekRate: 0.75,
                },
            ]}
        />,
    )

    expect(
        screen.getByRole("img", {name: "Weekly savings over time"}),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {name: "Weekly savings"}),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {name: "Recent savings trends"}),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("img", {
            name: "Twelve-week, fifty-two-week, and all-time savings rates over time",
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
