import {render, screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {useState} from "react"
import {expect, test} from "vitest"

import BalanceInput from "~/components/BalanceInput"

const account = {
    category: "cash" as const,
    id: 1,
    name: "Checking",
    type: "asset" as const,
}

const BalanceInputHarness = () => {
    const [value, setValue] = useState<number | null>(1234.56)

    return (
        <BalanceInput
            account={account}
            previousValue={1_200}
            value={value}
            onValueChange={setValue}
        />
    )
}

test("renders account details and a formatted balance", () => {
    render(<BalanceInputHarness />)

    expect(screen.getByText("cash")).toBeInTheDocument()
    expect(screen.getByText("asset")).toBeInTheDocument()
    expect(screen.getByText("Checking")).toBeInTheDocument()
    expect(
        screen.getByRole("heading", {
            name: "What is the current balance?",
        }),
    ).toBeInTheDocument()
    expect(screen.getByText("Current balance")).toHaveClass("text-right")
    expect(screen.getByText("$")).toBeInTheDocument()
    expect(screen.getByLabelText("Current balance")).toHaveValue("1,234.56")
    expect(screen.getByLabelText("Current balance")).toHaveAttribute(
        "placeholder",
        "1,200.00",
    )
})

test("accepts numeric values and rejects letters", async () => {
    const user = userEvent.setup()
    render(<BalanceInputHarness />)
    const input = screen.getByLabelText("Current balance")

    await user.clear(input)
    await user.type(input, "1300")

    expect(input).toHaveValue("1300")

    await user.tab()

    expect(input).toHaveValue("1,300.00")

    await user.click(input)
    await user.clear(input)
    await user.type(input, "letters")

    expect(input).toHaveValue("")
})
