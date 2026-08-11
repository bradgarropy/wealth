import {render, screen, within} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {expect, test} from "vitest"

import {AssetsProjectionChart} from "~/components/AssetsProjectionChart"

const snapshots = [
    {
        assetsCents: 90_000_000,
        date: "2025-08-09",
        liabilitiesCents: 20_000_000,
        netWorthCents: 70_000_000,
    },
    {
        assetsCents: 100_000_000,
        date: "2026-08-09",
        liabilitiesCents: 18_000_000,
        netWorthCents: 82_000_000,
    },
]

test("shows the default retirement projection", () => {
    render(<AssetsProjectionChart snapshots={snapshots} />)

    expect(screen.getByText("$1,000,000.00")).toBeInTheDocument()
    expect(screen.getByText("20%")).toBeInTheDocument()
    expect(screen.getByText("$200,000.00")).toBeInTheDocument()
    expect(screen.getByText("Target dates")).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("Expected target date")).getByText("2047"),
    ).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("High target date")).getByText("2042"),
    ).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("Current pace target date")).getByText(
            "2066",
        ),
    ).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("Low target date")).getByText("2059"),
    ).toBeInTheDocument()
    expect(
        screen.getByRole("img", {name: "Historical and projected assets"}),
    ).toBeInTheDocument()
})

test("updates the yearly withdrawal when the target changes", async () => {
    const user = userEvent.setup()
    render(<AssetsProjectionChart snapshots={snapshots} />)

    const target = screen.getByLabelText("Target assets")
    await user.clear(target)
    await user.type(target, "4000000")

    expect(screen.getByText("$160,000.00")).toBeInTheDocument()
})

test("changing expected growth does not change the current pace date", async () => {
    const user = userEvent.setup()
    render(<AssetsProjectionChart snapshots={snapshots} />)

    const growth = screen.getByLabelText("Expected yearly growth")
    await user.clear(growth)
    await user.type(growth, "6")

    expect(screen.getByLabelText("Target assets")).toHaveValue("5,000,000.00")
    expect(screen.getByText("$200,000.00")).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("Expected target date")).getByText("2054"),
    ).toBeInTheDocument()
    expect(
        within(screen.getByLabelText("Current pace target date")).getByText(
            "2066",
        ),
    ).toBeInTheDocument()
})
