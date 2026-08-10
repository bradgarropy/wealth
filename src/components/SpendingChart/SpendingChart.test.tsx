import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {expect, test} from "vitest"

import {SpendingChart} from "~/components/SpendingChart"

test("renders spending and its all-time average across history ranges", async () => {
    const user = userEvent.setup()
    const {container} = render(
        <SpendingChart
            defaultWindow={4}
            points={[
                {
                    date: "2026-07-24",
                    spendingCents: 100_000,
                    allTimeAverageCents: 100_000,
                },
                {
                    date: "2026-07-31",
                    spendingCents: 125_000,
                    allTimeAverageCents: 112_500,
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
        screen.getByRole("img", {
            name: "All-time spending average over time",
        }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", {name: "Show 4 weeks"})).toHaveAttribute(
        "aria-pressed",
        "true",
    )

    await user.click(screen.getByRole("button", {name: "Show all history"}))

    expect(
        screen.getByRole("button", {name: "Show all history"}),
    ).toHaveAttribute("aria-pressed", "true")
    expect(container.querySelectorAll(".recharts-bar")).toHaveLength(1)
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1)
})
