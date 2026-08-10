import {render, screen} from "@testing-library/react"
import {expect, test} from "vitest"

import Insights from "~/components/Insights"

test("renders", () => {
    render(<Insights />)

    expect(screen.getByRole("heading", {name: "Insights"})).toBeInTheDocument()
    expect(
        screen.getByText(
            "Understand the trends behind your financial captures.",
        ),
    ).toBeInTheDocument()
})
