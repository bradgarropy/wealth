import {expect, test} from "@playwright/test"

test("renders the financial overview", async ({page}) => {
    await page.goto("/")

    await expect(page).toHaveTitle("wealth | overview")
    await expect(page.getByRole("heading", {name: "Overview"})).toBeVisible()
    await expect(
        page.getByRole("region", {name: "Latest financial snapshot"}),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Financial history"}),
    ).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Latest accounts"}),
    ).toBeVisible()
})

test("navigates through primary and financial detail pages", async ({page}) => {
    await page.goto("/")
    const navigation = page.getByRole("navigation", {
        name: "Desktop navigation",
    })

    await navigation.getByRole("link", {name: "Insights"}).click()
    await expect(page).toHaveTitle("wealth | insights")
    await expect(page.getByRole("heading", {name: "Insights"})).toBeVisible()

    await navigation.getByRole("link", {name: "Accounts"}).click()
    await expect(page).toHaveTitle("wealth | accounts")
    await expect(page.getByRole("heading", {name: "Accounts"})).toBeVisible()

    await navigation.getByRole("link", {name: "Settings"}).click()
    await expect(page).toHaveTitle("wealth | settings")
    await expect(page.getByRole("heading", {name: "Settings"})).toBeVisible()

    await navigation.getByRole("link", {name: "New capture"}).click()
    await expect(page).toHaveTitle("wealth | capture")
    await expect(
        page.getByRole("heading", {
            name: "When are these balances from?",
        }),
    ).toBeVisible()

    await page.getByRole("link", {name: "wealth"}).click()
    const latestCapture = page.getByText("Latest capture:").getByRole("link")

    await latestCapture.click()
    await expect(page).toHaveTitle("wealth | capture summary")
    await expect(
        page.getByRole("heading", {name: "Capture summary"}),
    ).toBeVisible()

    await page
        .getByRole("region", {name: "Balances"})
        .getByRole("link", {name: "NFCU Credit"})
        .click()
    await expect(page).toHaveTitle("wealth | NFCU Credit")
    await expect(page.getByRole("heading", {name: "NFCU Credit"})).toBeVisible()
    await expect(
        page.getByRole("heading", {name: "Balance history"}),
    ).toBeVisible()
})
