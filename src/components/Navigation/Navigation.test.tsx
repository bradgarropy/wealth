import {render, screen, within} from "@testing-library/react"
import {MemoryRouter} from "react-router"
import {expect, test} from "vitest"

import Navigation from "~/components/Navigation"

test("renders", () => {
    render(
        <MemoryRouter>
            <Navigation />
        </MemoryRouter>,
    )

    const mobileNavigation = screen.getByRole("navigation", {
        name: "Mobile navigation",
    })
    const desktopNavigation = screen.getByRole("navigation", {
        name: "Desktop navigation",
    })

    expect(
        within(mobileNavigation).getByRole("link", {name: "Overview"}),
    ).toHaveAttribute("href", "/")
    expect(
        within(mobileNavigation).getByRole("link", {name: "Insights"}),
    ).toHaveAttribute("href", "/insights")
    expect(
        within(mobileNavigation).getByRole("link", {name: "Accounts"}),
    ).toHaveAttribute("href", "/accounts")
    expect(
        within(mobileNavigation).getByRole("link", {name: "Capture"}),
    ).toHaveAttribute("href", "/capture")

    expect(
        within(desktopNavigation).getByRole("link", {name: "Overview"}),
    ).toHaveAttribute("href", "/")
    expect(
        within(desktopNavigation).getByRole("link", {name: "Insights"}),
    ).toHaveAttribute("href", "/insights")
    expect(
        within(desktopNavigation).getByRole("link", {name: "Accounts"}),
    ).toHaveAttribute("href", "/accounts")
    expect(
        within(desktopNavigation).getByRole("link", {name: "New capture"}),
    ).toHaveAttribute("href", "/capture")

    expect(screen.getAllByRole("link", {name: "Settings"})).toHaveLength(2)
})
