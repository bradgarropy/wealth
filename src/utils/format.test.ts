import {expect, test} from "vitest"

import {
    formatChartDate,
    formatCompactMoney,
    formatDate,
    formatDateInput,
    formatMoney,
    formatMoneyChange,
    formatMoneyParts,
    formatPercentage,
    formatPercentageChange,
} from "~/utils/format"

test("formats compact money for chart axes", () => {
    expect(formatCompactMoney(125_000_000)).toEqual("$1.3M")
    expect(formatCompactMoney(25_000_000)).toEqual("$250K")
})

test("formats cents as dollars", () => {
    expect(formatMoney(0)).toEqual("$0.00")
    expect(formatMoney(42)).toEqual("$0.42")
    expect(formatMoney(123456)).toEqual("$1,234.56")
})

test("formats negative cents as negative dollars", () => {
    expect(formatMoney(-123456)).toEqual("-$1,234.56")
})

test("formats signed financial changes", () => {
    expect(formatMoneyChange(123_456)).toEqual("+$1,234.56")
    expect(formatMoneyChange(-123_456)).toEqual("-$1,234.56")
    expect(formatMoneyChange(0)).toEqual("$0.00")
    expect(formatPercentageChange(0.1234)).toEqual("+12.34%")
    expect(formatPercentageChange(-0.1234)).toEqual("-12.34%")
    expect(formatPercentageChange(0)).toEqual("0%")
})

test("formats an unsigned percentage", () => {
    expect(formatPercentage(0.4278)).toEqual("42.78%")
    expect(formatPercentage(0)).toEqual("0%")
})

test("formats money into currency and amount parts", () => {
    expect(formatMoneyParts(123456)).toEqual({
        amount: "1,234.56",
        currency: "$",
    })
})

test("formats date strings with the full month name", () => {
    expect(formatDate("2026-07-24")).toEqual("July 24, 2026")
})

test("formats compact chart dates", () => {
    expect(formatChartDate("2026-07-24")).toEqual("Jul 24")
})

test("formats dates for date inputs in UTC", () => {
    expect(formatDateInput(new Date("2026-07-03T00:00:00.000Z"))).toEqual(
        "2026-07-03",
    )
    expect(formatDateInput(new Date("2026-07-03T23:59:59.999Z"))).toEqual(
        "2026-07-03",
    )
})

test("pads single-digit months and days", () => {
    expect(formatDateInput(new Date("2026-01-05T12:00:00.000Z"))).toEqual(
        "2026-01-05",
    )
})
