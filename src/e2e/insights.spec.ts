import {expect, type Locator, test} from "@playwright/test"

const replaceNumber = async (input: Locator, value: string) => {
    await input.click()
    await input.press("ControlOrMeta+A")
    await input.press("Backspace")
    await input.pressSequentially(value)
}

test("renders and updates financial insights", async ({page}) => {
    await page.goto("/insights")

    await expect(page).toHaveTitle("wealth | insights")
    await expect(page.getByRole("heading", {name: "Insights"})).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Spending", exact: true}),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Savings", exact: true}),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Retirement outlook"}),
    ).toBeVisible()

    for (const chartName of [
        "Weekly spending over time",
        "Twelve-week, fifty-two-week, and all-time spending averages over time",
        "Weekly savings over time",
        "Twelve-week, fifty-two-week, and all-time savings rates over time",
        "Historical and projected assets",
    ]) {
        await expect(page.getByRole("img", {name: chartName})).toBeVisible()
    }

    const targetDates = page.locator('[aria-label$="target date"]')
    await expect(targetDates).toHaveCount(4)
    expect(
        await targetDates.evaluateAll(elements =>
            elements.map(element => element.getAttribute("aria-label")),
        ),
    ).toEqual([
        "Current pace target date",
        "High target date",
        "Expected target date",
        "Low target date",
    ])

    const currentPaceDate = page.getByLabel("Current pace target date")
    const highDate = page.getByLabel("High target date")
    const expectedDate = page.getByLabel("Expected target date")
    const lowDate = page.getByLabel("Low target date")

    const target = page.getByLabel("Target assets")
    await replaceNumber(target, "4000000")
    await expect(page.getByText("$160,000.00", {exact: true})).toBeVisible()
    await replaceNumber(target, "5000000")
    await expect(page.getByText("$200,000.00", {exact: true})).toBeVisible()

    const initialCurrentPaceDate = await currentPaceDate.textContent()
    const initialHighDate = await highDate.textContent()
    const initialExpectedDate = await expectedDate.textContent()
    const initialLowDate = await lowDate.textContent()

    const growth = page.getByLabel("Expected yearly growth")
    await replaceNumber(growth, "6")

    await expect(currentPaceDate).toHaveText(initialCurrentPaceDate ?? "")
    await expect(highDate).not.toHaveText(initialHighDate ?? "")
    await expect(expectedDate).not.toHaveText(initialExpectedDate ?? "")
    await expect(lowDate).not.toHaveText(initialLowDate ?? "")
})
