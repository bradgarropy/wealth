import {expect, test} from "@playwright/test"
import {addDays, format} from "date-fns"

import {ACCOUNT} from "~/constants"

const browserDateOffsets: Record<string, number> = {
    chromium: 1,
    firefox: 2,
    webkit: 3,
}

test("completes and persists the weekly capture flow", async ({
    page,
}, testInfo) => {
    const dateOffset = browserDateOffsets[testInfo.project.name]
    const captureDate = addDays(new Date(), dateOffset)
    const captureDateValue = format(captureDate, "yyyy-MM-dd")
    const captureDateLabel = format(captureDate, "MMMM d, yyyy")
    const calendarDateLabel = format(captureDate, "PPPP")

    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: async (value: string) => {
                    window.sessionStorage.setItem("copied-text", value)
                },
            },
        })
    })
    await page.goto("/capture")

    await page.getByRole("button", {name: "Balance date"}).click()
    await page.getByRole("button", {name: calendarDateLabel}).click()
    await expect(
        page.getByRole("button", {name: "Balance date"}),
    ).toContainText(captureDateLabel)
    await page.getByRole("button", {name: "Begin capture"}).click()

    const currentBalance = page.getByRole("textbox", {
        name: "Current balance",
    })
    const nextAccount = page.getByRole("button", {name: "Next account"})

    await expect(page.getByText("NFCU Credit", {exact: true})).toBeVisible()
    await expect(nextAccount).toBeDisabled()
    await currentBalance.fill("100")
    await expect(nextAccount).toBeEnabled()
    await nextAccount.click()

    await expect(page.getByText(ACCOUNT.CHECKING, {exact: true})).toBeVisible()
    await currentBalance.fill("22100")
    await nextAccount.click()

    await expect(page.getByText(ACCOUNT.EMERGENCY, {exact: true})).toBeVisible()
    await page.getByRole("button", {name: "Back"}).click()
    await expect(page.getByText(ACCOUNT.CHECKING, {exact: true})).toBeVisible()
    await expect(currentBalance).toHaveValue("22,100.00")
    await nextAccount.click()

    await expect(page.getByText(ACCOUNT.EMERGENCY, {exact: true})).toBeVisible()
    await expect(currentBalance).toHaveValue("60,000.00")
    await nextAccount.click()

    await expect(page.getByText(ACCOUNT.SAVINGS, {exact: true})).toBeVisible()
    await currentBalance.fill("12000")
    await nextAccount.click()

    await expect(page.getByText("401k", {exact: true})).toBeVisible()
    await currentBalance.fill("320000")
    await nextAccount.click()

    await expect(page.getByText("HSA", {exact: true})).toBeVisible()
    await currentBalance.fill("6500")
    await nextAccount.click()

    await expect(
        page.getByText(ACCOUNT.INVESTMENT, {exact: true}),
    ).toBeVisible()
    await currentBalance.fill("280000")
    await nextAccount.click()

    await expect(page.getByText("Mortgage", {exact: true})).toBeVisible()
    await expect(currentBalance).toHaveValue("181,350.00")
    await page.getByRole("button", {name: "Confirm balances"}).click()

    await expect(
        page.getByRole("heading", {name: "Confirm balances"}),
    ).toBeVisible()
    await expect(page.getByRole("heading", {name: "Assets"})).toBeVisible()
    await expect(page.getByRole("heading", {name: "Liabilities"})).toBeVisible()
    for (const amount of [
        "$100.00",
        "$22,100.00",
        "$60,000.00",
        "$12,000.00",
        "$320,000.00",
        "$6,500.00",
        "$280,000.00",
        "$181,350.00",
    ]) {
        await expect(page.getByText(amount, {exact: true})).toBeVisible()
    }
    await page.getByRole("button", {name: "Confirm and continue"}).click()

    await expect(
        page.getByRole("heading", {name: "Pay off your credit cards"}),
    ).toBeVisible()
    const continueButton = page.getByRole("button", {name: "Continue"})
    const cardPayment = page.getByRole("checkbox", {name: /NFCU Credit/})

    await expect(continueButton).toBeDisabled()
    await cardPayment.check()
    await expect(continueButton).toBeEnabled()
    await continueButton.click()

    await expect(
        page.getByRole("heading", {name: "Move your excess cash"}),
    ).toBeVisible()
    const investmentTransfer = page.getByRole("checkbox", {
        name: /Investments/,
    })
    const savingsTransfer = page.getByRole("checkbox", {name: /Savings/})
    const finishButton = page.getByRole("button", {name: "Finish"})

    await expect(
        page.getByRole("button", {
            name: "Copy $1,500.00 transfer to Investments",
        }),
    ).toBeVisible()
    await expect(
        page.getByRole("button", {
            name: "Copy $500.00 transfer to Savings",
        }),
    ).toBeVisible()
    await expect(finishButton).toBeDisabled()

    await page
        .getByRole("button", {
            name: "Copy $1,500.00 transfer to Investments",
        })
        .click()
    await expect(
        page.getByText("$1,500.00 copied", {exact: true}),
    ).toBeAttached()
    await expect
        .poll(() =>
            page.evaluate(() => window.sessionStorage.getItem("copied-text")),
        )
        .toBe("1500.00")
    await expect(investmentTransfer).not.toBeChecked()

    await investmentTransfer.check()
    await expect(finishButton).toBeDisabled()
    await savingsTransfer.check()
    await expect(finishButton).toBeEnabled()
    await finishButton.click()

    await expect(
        page.getByRole("heading", {name: "Weekly finances complete"}),
    ).toBeVisible()
    const summaryLink = page.getByRole("link", {name: "View capture summary"})

    await expect(summaryLink).toHaveAttribute(
        "href",
        `/capture/${captureDateValue}`,
    )
    await summaryLink.click()

    await expect(page).toHaveURL(new RegExp(`/capture/${captureDateValue}$`))
    await expect(page).toHaveTitle("wealth | capture summary")
    await expect(
        page.getByRole("heading", {name: "Capture summary"}),
    ).toBeVisible()
    await expect(page.getByText(captureDateLabel, {exact: true})).toBeVisible()

    const totals = page.getByRole("region", {
        name: "Financial snapshot totals",
    })
    await expect(totals).toContainText("$700,600.00")
    await expect(totals).toContainText("$181,450.00")
    await expect(totals).toContainText("$519,150.00")

    const balances = page.getByRole("region", {name: "Balances"})
    await expect(balances).toContainText("NFCU Credit")
    await expect(balances).toContainText("$100.00")
    await expect(balances).toContainText(ACCOUNT.CHECKING)
    await expect(balances).toContainText("$22,100.00")

    const cashFlow = page.getByRole("region", {name: "Cash flow totals"})
    await expect(cashFlow).toContainText("$100.00")
    await expect(cashFlow).toContainText("$2,000.00")

    const savings = page.getByRole("region", {name: "Savings breakdown"})
    await expect(savings).toContainText("$1,500.00")
    await expect(savings).toContainText("$500.00")
})
