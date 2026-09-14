import {execFileSync} from "node:child_process"
import {existsSync, mkdtempSync, readFileSync, rmSync, statSync} from "node:fs"
import {tmpdir} from "node:os"
import path from "node:path"
import {fileURLToPath} from "node:url"

import {parse} from "csv-parse/sync"
import {getPlatformProxy} from "wrangler"

import {type Database, getDatabaseFromEnv} from "~/db/client"
import type {
    Account,
    AccountInput,
    BalanceInput,
    SettingsInput,
} from "~/db/queries"
import {
    getAccounts,
    getAllBalances,
    getSettings,
    setSettings,
    upsertAccounts,
    upsertBalances,
} from "~/db/queries"

type Args = {
    file?: string
    remote: boolean
}

type CsvRow = Record<string, string>

type ImportedBalance = {
    accountName: string
    amountCents: number
    date: string
}

type ImportPayload = {
    accounts: AccountInput[]
    balances: ImportedBalance[]
    settings: SettingsInput
}

type ImportedAccountBalance = Awaited<ReturnType<typeof getAllBalances>>[number]

type BalanceSummary = {
    balanceRows: number
    blankCardCells: number
    columns: number
    endDate: string
    explicitZeroCardCells: number
    headers: string[]
    rows: number
    startDate: string
}

type ConstantsSummary = {
    columns: number
    headers: string[]
    rows: number
}

const moneyFormatter = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
})

const BALANCE_FILE_NAME = "Balances-Raw.csv"
const CONSTANTS_FILE_NAME = "Constants-Baselines.csv"
const OVERVIEW_FILE_NAME = "Overview-Overview.csv"
const SAVING_FILE_NAME = "Saving-Savings.csv"
const SAVING_RATIO_FILE_NAME = "Saving-Ratio.csv"
const SPENDING_FILE_NAME = "Spending-Credit Cards.csv"

const defaultSettings = {
    defaultWindow: 52,
    excessInvestPct: 75,
    excessSavePct: 25,
} satisfies Pick<
    SettingsInput,
    "defaultWindow" | "excessInvestPct" | "excessSavePct"
>

const accountInputs = [
    {
        archived: false,
        category: "credit",
        name: "NFCU",
        sortOrder: 10,
        type: "liability",
    },
    {
        archived: false,
        category: "credit",
        name: "Apple",
        sortOrder: 20,
        type: "liability",
    },
    {
        archived: false,
        category: "cash",
        name: "Checking",
        sortOrder: 30,
        type: "asset",
    },
    {
        archived: false,
        category: "savings",
        name: "Emergency",
        sortOrder: 40,
        type: "asset",
    },
    {
        archived: false,
        category: "savings",
        name: "Savings",
        sortOrder: 50,
        type: "asset",
    },
    {
        archived: false,
        category: "retirement",
        name: "401k",
        sortOrder: 60,
        type: "asset",
    },
    {
        archived: false,
        category: "investment",
        name: "HSA",
        sortOrder: 70,
        type: "asset",
    },
    {
        archived: false,
        category: "investment",
        name: "Investment",
        sortOrder: 80,
        type: "asset",
    },
    {
        archived: false,
        category: "mortgage",
        name: "Mortgage",
        sortOrder: 90,
        type: "liability",
    },
] satisfies AccountInput[]

const expectedBalanceHeaders = [
    "Date",
    ...accountInputs.map(account => account.name),
]

const expectedConstantsHeaders = ["Account", "Baseline"]
const expectedOverviewHeaders = [
    "Date",
    "Assets",
    "Debt",
    "Worth",
    "Growth Rate (R1)",
    "Growth Rate (R4)",
    "Growth Rate (R12)",
]
const expectedSavingHeaders = [
    "Date",
    "NFCU",
    "Apple",
    "Spent",
    "Checking",
    "Investments",
    "Savings",
    "Saved",
    "Rate",
    "Average",
    "Average (R4)",
    "Average (R12)",
]
const expectedSavingRatioHeaders = ["Category", "Percent"]
const expectedSpendingHeaders = [
    "Date",
    "NFCU",
    "Apple",
    "Total",
    "Average",
    "Average (R4)",
    "Average (R12)",
]

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
)

const parseArgs = (argv: string[]): Args => {
    const args: Args = {remote: false}

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]

        if (arg === "--remote") {
            args.remote = true
            continue
        }

        if (!args.file) {
            args.file = arg
        }
    }

    return args
}

const assertRequiredPath = (label: string, value?: string) => {
    if (!value) {
        throw new Error(`Missing required ${label} path.`)
    }

    const resolved = path.resolve(value)

    if (!existsSync(resolved)) {
        throw new Error(`The ${label} path does not exist: ${resolved}`)
    }

    const relative = path.relative(repoRoot, resolved)

    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        throw new Error(
            `The ${label} path must live outside the repository: ${resolved}`,
        )
    }

    return resolved
}

const assertRequiredDirectory = (label: string, value?: string) => {
    const resolved = assertRequiredPath(label, value)

    if (!statSync(resolved).isDirectory()) {
        throw new Error(`The ${label} path must be a directory: ${resolved}`)
    }

    return resolved
}

const assertRequiredNumbersFile = (value?: string) => {
    const resolved = assertRequiredPath("Numbers file", value)

    if (path.extname(resolved).toLowerCase() !== ".numbers") {
        throw new Error(`Expected a .numbers file, received: ${resolved}`)
    }

    return resolved
}

const numbersExportScript = `
on run argv
    set inputPath to item 1 of argv
    set outputPath to item 2 of argv

    tell application "Numbers"
        set sourceDocument to open POSIX file inputPath

        try
            export sourceDocument to POSIX file outputPath as CSV
        on error errorMessage number errorNumber
            close sourceDocument saving no
            error errorMessage number errorNumber
        end try

        close sourceDocument saving no
    end tell
end run
`

const exportNumbers = (filePath: string) => {
    if (process.platform !== "darwin") {
        throw new Error("Importing a Numbers file requires macOS and Numbers.")
    }

    const exportDir = mkdtempSync(path.join(tmpdir(), "wealth-import-"))

    try {
        execFileSync(
            "osascript",
            ["-e", numbersExportScript, "--", filePath, exportDir],
            {stdio: "inherit"},
        )
    } catch (error) {
        rmSync(exportDir, {force: true, recursive: true})
        throw error
    }

    return exportDir
}

const getImportPaths = (dir?: string) => {
    const resolvedDir = assertRequiredDirectory("dir", dir)

    return {
        balances: assertRequiredPath(
            "balances",
            path.join(resolvedDir, BALANCE_FILE_NAME),
        ),
        constants: assertRequiredPath(
            "constants",
            path.join(resolvedDir, CONSTANTS_FILE_NAME),
        ),
        overview: assertRequiredPath(
            "overview",
            path.join(resolvedDir, OVERVIEW_FILE_NAME),
        ),
        saving: assertRequiredPath(
            "saving",
            path.join(resolvedDir, SAVING_FILE_NAME),
        ),
        savingRatio: assertRequiredPath(
            "saving ratio",
            path.join(resolvedDir, SAVING_RATIO_FILE_NAME),
        ),
        spending: assertRequiredPath(
            "spending",
            path.join(resolvedDir, SPENDING_FILE_NAME),
        ),
    }
}

const readCsv = (filePath: string) => {
    const contents = readFileSync(filePath, "utf8")

    return parse(contents, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as CsvRow[]
}

const readHeaders = (filePath: string) => {
    const contents = readFileSync(filePath, "utf8")
    const [headers = []] = parse(contents, {
        bom: true,
        to_line: 1,
        trim: true,
    }) as string[][]

    return headers
}

const parseMoney = (value: string) => {
    const trimmed = value.trim()

    if (!trimmed) {
        return null
    }

    const isParenthesized = trimmed.includes("(") && trimmed.includes(")")
    const normalized = trimmed.replaceAll(/[$,\t\s()]/gu, "")

    if (!normalized) {
        return null
    }

    const amount = Number(normalized)

    if (!Number.isFinite(amount)) {
        throw new Error(`Invalid money value: ${value}`)
    }

    return Math.round(Math.abs(isParenthesized ? -amount : amount) * 100)
}

const parseRequiredPercent = (value: string, label: string) => {
    const trimmed = value.trim()

    if (!trimmed.endsWith("%")) {
        throw new Error(`Invalid ${label}: ${value}`)
    }

    const percent = Number(trimmed.slice(0, -1))

    if (!Number.isFinite(percent)) {
        throw new Error(`Invalid ${label}: ${value}`)
    }

    return percent
}

const normalizeDate = (value: string) => {
    const match = /^(?<month>\d{1,2})\/(?<day>\d{1,2})\/(?<year>\d{4})$/u.exec(
        value.trim(),
    )

    if (!match?.groups) {
        throw new Error(`Invalid date value: ${value}`)
    }

    const month = Number(match.groups.month)
    const day = Number(match.groups.day)
    const year = Number(match.groups.year)

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`Invalid date value: ${value}`)
    }

    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

    if (!Number.isInteger(day) || day < 1 || day > lastDayOfMonth) {
        throw new Error(`Invalid date value: ${value}`)
    }

    return [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0"),
    ].join("-")
}

const assertHeaders = (actual: string[], expected: string[]) => {
    if (actual.length !== expected.length) {
        throw new Error(
            `Expected ${expected.length} balance columns, received ${actual.length}.`,
        )
    }

    for (const [index, expectedHeader] of expected.entries()) {
        const actualHeader = actual[index]

        if (actualHeader !== expectedHeader) {
            throw new Error(
                `Expected balance column ${index + 1} to be "${expectedHeader}", received "${actualHeader}".`,
            )
        }
    }
}

const buildImportPayload = (
    balanceRows: CsvRow[],
    balanceHeaders: string[],
    constantsRows: CsvRow[],
    constantsHeaders: string[],
): ImportPayload => {
    assertHeaders(balanceHeaders, expectedBalanceHeaders)
    assertHeaders(constantsHeaders, expectedConstantsHeaders)

    return {
        accounts: accountInputs,
        balances: parseBalances(balanceRows),
        settings: parseSettings(constantsRows),
    }
}

const parseBalances = (rows: CsvRow[]) => {
    const balances: ImportedBalance[] = []

    for (const row of rows) {
        const date = normalizeDate(row.Date ?? "")

        for (const account of accountInputs) {
            const amountCents = parseMoney(row[account.name] ?? "")

            if (account.category === "credit" && amountCents === null) {
                continue
            }

            if (amountCents === null) {
                throw new Error(`Missing ${account.name} balance for ${date}.`)
            }

            balances.push({
                accountName: account.name,
                amountCents,
                date,
            })
        }
    }

    return balances
}

const parseSettings = (rows: CsvRow[]): SettingsInput => {
    const checking = rows.find(row => row.Account === "Checking")
    const savings = rows.find(row => row.Account === "Savings")

    return {
        checkingBaselineCents: parseRequiredMoney(
            checking?.Baseline ?? "",
            "Checking baseline",
        ),
        emergencyBaselineCents: parseRequiredMoney(
            savings?.Baseline ?? "",
            "Emergency baseline",
        ),
        ...defaultSettings,
    }
}

const parseRequiredMoney = (value: string, label: string) => {
    const amountCents = parseMoney(value)

    if (amountCents === null) {
        throw new Error(`Missing ${label}.`)
    }

    return amountCents
}

const parseOptionalMoneyAsZero = (value: string) => parseMoney(value) ?? 0

const getBalanceDateIndex = (balances: ImportedAccountBalance[]) => {
    const balancesByDate = new Map<string, ImportedAccountBalance[]>()

    for (const balance of balances) {
        const entries = balancesByDate.get(balance.date) ?? []

        entries.push(balance)
        balancesByDate.set(balance.date, entries)
    }

    return balancesByDate
}

const sumBalances = (
    balances: ImportedAccountBalance[],
    predicate: (balance: ImportedAccountBalance) => boolean,
) => {
    return balances
        .filter(predicate)
        .reduce((total, balance) => total + balance.amountCents, 0)
}

const getAccountBalance = (
    balances: ImportedAccountBalance[],
    accountName: string,
) => {
    return (
        balances.find(balance => balance.accountName === accountName)
            ?.amountCents ?? 0
    )
}

const assertCentsEqual = (
    label: string,
    date: string,
    actual: number,
    expected: number,
) => {
    if (actual !== expected) {
        throw new Error(
            `${label} mismatch for ${date}: expected ${formatCents(expected)}, received ${formatCents(actual)} (delta ${formatCents(actual - expected)}).`,
        )
    }
}

const assertOptionalCentsEqual = (
    label: string,
    date: string,
    actual: number,
    expectedValue: string,
) => {
    const expected = parseMoney(expectedValue)

    if (expected === null) {
        return
    }

    assertCentsEqual(label, date, actual, expected)
}

const assertDateSetsEqual = (
    label: string,
    actualDates: string[],
    expectedDates: string[],
) => {
    const actual = new Set(actualDates)
    const expected = new Set(expectedDates)
    const missing = expectedDates.filter(date => !actual.has(date))
    const extra = actualDates.filter(date => !expected.has(date))

    if (missing.length > 0 || extra.length > 0) {
        throw new Error(
            `${label} dates do not match. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
        )
    }
}

const validateUniqueDates = (label: string, dates: string[]) => {
    const seen = new Set<string>()
    const duplicates = new Set<string>()

    for (const date of dates) {
        if (seen.has(date)) {
            duplicates.add(date)
        }

        seen.add(date)
    }

    if (duplicates.size > 0) {
        throw new Error(
            `${label} contains duplicate dates: ${[...duplicates].join(", ")}.`,
        )
    }
}

const validateSavingRatio = (rows: CsvRow[], settings: SettingsInput) => {
    const investments = rows.find(row => row.Category === "Investments")
    const savings = rows.find(row => row.Category === "Savings")
    const investmentsPct = parseRequiredPercent(
        investments?.Percent ?? "",
        "Investments saving ratio",
    )
    const savingsPct = parseRequiredPercent(
        savings?.Percent ?? "",
        "Savings saving ratio",
    )

    if (investmentsPct !== settings.excessInvestPct) {
        throw new Error(
            `Investments saving ratio mismatch: expected ${settings.excessInvestPct}%, received ${investmentsPct}%.`,
        )
    }

    if (savingsPct !== settings.excessSavePct) {
        throw new Error(
            `Savings saving ratio mismatch: expected ${settings.excessSavePct}%, received ${savingsPct}%.`,
        )
    }

    if (investmentsPct + savingsPct !== 100) {
        throw new Error(
            `Saving ratios must add to 100%, received ${investmentsPct + savingsPct}%.`,
        )
    }
}

const validateOverview = (
    rows: CsvRow[],
    balancesByDate: Map<string, ImportedAccountBalance[]>,
) => {
    const dates = rows.map(row => normalizeDate(row.Date ?? ""))

    validateUniqueDates("Overview", dates)
    assertDateSetsEqual("Overview", [...balancesByDate.keys()], dates)

    rows.forEach((row, index) => {
        const date = dates[index] ?? ""
        const balances = balancesByDate.get(date) ?? []
        const assets = sumBalances(
            balances,
            balance => balance.accountType === "asset",
        )
        const liabilities = sumBalances(
            balances,
            balance => balance.accountType === "liability",
        )

        assertCentsEqual(
            "Overview assets",
            date,
            assets,
            parseRequiredMoney(row.Assets ?? "", "overview assets"),
        )
        assertCentsEqual(
            "Overview debt",
            date,
            liabilities,
            parseRequiredMoney(row.Debt ?? "", "overview debt"),
        )
        assertCentsEqual(
            "Overview worth",
            date,
            assets - liabilities,
            parseRequiredMoney(row.Worth ?? "", "overview worth"),
        )
    })
}

const validateSpending = (
    rows: CsvRow[],
    balancesByDate: Map<string, ImportedAccountBalance[]>,
) => {
    const dates = rows.map(row => normalizeDate(row.Date ?? ""))

    validateUniqueDates("Spending", dates)
    assertDateSetsEqual("Spending", [...balancesByDate.keys()], dates)

    rows.forEach((row, index) => {
        const date = dates[index] ?? ""
        const balances = balancesByDate.get(date) ?? []
        const nfcu = getAccountBalance(balances, "NFCU")
        const apple = getAccountBalance(balances, "Apple")

        assertCentsEqual(
            "Spending NFCU",
            date,
            nfcu,
            parseOptionalMoneyAsZero(row.NFCU ?? ""),
        )
        assertCentsEqual(
            "Spending Apple",
            date,
            apple,
            parseOptionalMoneyAsZero(row.Apple ?? ""),
        )
        assertCentsEqual(
            "Spending total",
            date,
            nfcu + apple,
            parseOptionalMoneyAsZero(row.Total ?? ""),
        )
    })
}

const validateSaving = (
    rows: CsvRow[],
    balancesByDate: Map<string, ImportedAccountBalance[]>,
    settings: SettingsInput,
) => {
    const dates = rows.map(row => normalizeDate(row.Date ?? ""))

    validateUniqueDates("Saving", dates)
    assertDateSetsEqual("Saving", [...balancesByDate.keys()], dates)

    rows.forEach((row, index) => {
        const date = dates[index] ?? ""
        const balances = balancesByDate.get(date) ?? []
        const nfcu = getAccountBalance(balances, "NFCU")
        const apple = getAccountBalance(balances, "Apple")
        const checking = getAccountBalance(balances, "Checking")
        const availableChecking = checking - nfcu - apple
        const saved = Math.max(
            availableChecking - settings.checkingBaselineCents,
            0,
        )
        const investmentsSaved = Math.round(
            (saved * settings.excessInvestPct) / 100,
        )
        const savingsSaved = Math.round((saved * settings.excessSavePct) / 100)

        assertCentsEqual(
            "Saving spent",
            date,
            nfcu + apple,
            parseOptionalMoneyAsZero(row.Spent ?? ""),
        )
        assertCentsEqual(
            "Saving checking",
            date,
            checking,
            parseRequiredMoney(row.Checking ?? "", "saving checking"),
        )
        assertOptionalCentsEqual(
            "Saving total saved",
            date,
            saved,
            row.Saved ?? "",
        )
        assertOptionalCentsEqual(
            "Saving investments saved",
            date,
            investmentsSaved,
            row.Investments ?? "",
        )
        assertOptionalCentsEqual(
            "Saving savings saved",
            date,
            savingsSaved,
            row.Savings ?? "",
        )
    })
}

const validateImport = async (
    db: Database,
    rows: {
        overview: CsvRow[]
        saving: CsvRow[]
        savingRatio: CsvRow[]
        spending: CsvRow[]
    },
    settings: SettingsInput,
) => {
    const savedSettings = await getSettings(db)

    if (!savedSettings) {
        throw new Error("Settings were not imported.")
    }

    assertCentsEqual(
        "Settings checking baseline",
        "settings",
        savedSettings.checkingBaselineCents,
        settings.checkingBaselineCents,
    )
    assertCentsEqual(
        "Settings emergency baseline",
        "settings",
        savedSettings.emergencyBaselineCents,
        settings.emergencyBaselineCents,
    )

    if (savedSettings.excessInvestPct !== settings.excessInvestPct) {
        throw new Error("Settings excessInvestPct was not imported.")
    }

    if (savedSettings.excessSavePct !== settings.excessSavePct) {
        throw new Error("Settings excessSavePct was not imported.")
    }

    if (savedSettings.defaultWindow !== settings.defaultWindow) {
        throw new Error("Settings defaultWindow was not imported.")
    }

    validateSavingRatio(rows.savingRatio, settings)

    const accounts = await getAccounts(db)

    if (accounts.length !== accountInputs.length) {
        throw new Error(
            `Expected ${accountInputs.length} accounts, found ${accounts.length}.`,
        )
    }

    const accountNames = accounts.map(account => account.name)
    const expectedAccountNames = accountInputs.map(account => account.name)

    if (accountNames.join(",") !== expectedAccountNames.join(",")) {
        throw new Error(
            `Imported accounts are out of sync. Expected ${expectedAccountNames.join(", ")}, received ${accountNames.join(", ")}.`,
        )
    }

    const allBalances = await getAllBalances(db)
    const balancesByDate = getBalanceDateIndex(allBalances)

    validateOverview(rows.overview, balancesByDate)
    validateSpending(rows.spending, balancesByDate)
    validateSaving(rows.saving, balancesByDate, settings)
}

const groupBalancesByDate = (
    balances: ImportedBalance[],
    accounts: Account[],
) => {
    const accountIdsByName = new Map(
        accounts.map(account => [account.name, account.id]),
    )
    const balancesByDate = new Map<string, BalanceInput[]>()

    for (const balance of balances) {
        const accountId = accountIdsByName.get(balance.accountName)

        if (!accountId) {
            throw new Error(`Missing account id for ${balance.accountName}.`)
        }

        const entries = balancesByDate.get(balance.date) ?? []

        entries.push({
            accountId,
            amountCents: balance.amountCents,
        })

        balancesByDate.set(balance.date, entries)
    }

    return balancesByDate
}

const writeImport = async (
    payload: ImportPayload,
    options: Pick<Args, "remote">,
    validationRows: Parameters<typeof validateImport>[1],
) => {
    const platform = await getPlatformProxy<Env>({
        remoteBindings: options.remote,
    })

    try {
        const db = getDatabaseFromEnv(platform.env)

        await upsertAccounts(db, payload.accounts)
        await setSettings(db, payload.settings)

        const accounts = await getAccounts(db)
        const balancesByDate = groupBalancesByDate(payload.balances, accounts)

        for (const [date, balances] of balancesByDate) {
            await upsertBalances(db, date, balances)
        }

        await validateImport(db, validationRows, payload.settings)
    } finally {
        await platform.dispose()
    }
}

const summarizeBalances = (
    headers: string[],
    rows: ReturnType<typeof readCsv>,
    payload: ImportPayload,
): BalanceSummary => {
    const creditBalances = payload.balances.filter(
        balance =>
            balance.accountName === "NFCU" || balance.accountName === "Apple",
    )
    const explicitZeroCardCells = creditBalances.filter(
        balance => balance.amountCents === 0,
    ).length
    const blankCardCells = rows.length * 2 - creditBalances.length

    return {
        balanceRows: payload.balances.length,
        blankCardCells,
        columns: headers.length,
        endDate: payload.balances.at(-1)?.date ?? "",
        explicitZeroCardCells,
        headers,
        rows: rows.length,
        startDate: payload.balances[0]?.date ?? "",
    }
}

const summarizeConstants = (
    headers: string[],
    rows: ReturnType<typeof readCsv>,
): ConstantsSummary => {
    return {
        columns: headers.length,
        headers,
        rows: rows.length,
    }
}

const formatCents = (cents: number) => moneyFormatter.format(cents / 100)

const getHeading = (args: Args) =>
    args.remote ? "Remote import complete" : "Local import complete"

const runImport = async (args: Args, dir: string) => {
    const {
        balances: balancesPath,
        constants: constantsPath,
        overview: overviewPath,
        saving: savingPath,
        savingRatio: savingRatioPath,
        spending: spendingPath,
    } = getImportPaths(dir)

    const balanceHeaders = readHeaders(balancesPath)
    const balanceRows = readCsv(balancesPath)
    const constantsHeaders = readHeaders(constantsPath)
    const constantsRows = readCsv(constantsPath)
    const overviewHeaders = readHeaders(overviewPath)
    const overviewRows = readCsv(overviewPath)
    const savingHeaders = readHeaders(savingPath)
    const savingRows = readCsv(savingPath)
    const savingRatioHeaders = readHeaders(savingRatioPath)
    const savingRatioRows = readCsv(savingRatioPath)
    const spendingHeaders = readHeaders(spendingPath)
    const spendingRows = readCsv(spendingPath)

    assertHeaders(overviewHeaders, expectedOverviewHeaders)
    assertHeaders(savingHeaders, expectedSavingHeaders)
    assertHeaders(savingRatioHeaders, expectedSavingRatioHeaders)
    assertHeaders(spendingHeaders, expectedSpendingHeaders)

    const payload = buildImportPayload(
        balanceRows,
        balanceHeaders,
        constantsRows,
        constantsHeaders,
    )
    const balances = summarizeBalances(balanceHeaders, balanceRows, payload)
    const constants = summarizeConstants(constantsHeaders, constantsRows)

    await writeImport(
        payload,
        {remote: args.remote},
        {
            overview: overviewRows,
            saving: savingRows,
            savingRatio: savingRatioRows,
            spending: spendingRows,
        },
    )

    console.log(getHeading(args))
    console.log(
        `  balances: ${path.basename(balancesPath)} (${balances.rows} rows)`,
    )
    console.log(
        `  constants: ${path.basename(constantsPath)} (${constants.rows} rows)`,
    )
    console.log(`  overview: ${path.basename(overviewPath)} validated`)
    console.log(`  spending: ${path.basename(spendingPath)} validated`)
    console.log(`  saving: ${path.basename(savingPath)} validated`)
    console.log(`  saving ratio: ${path.basename(savingRatioPath)} validated`)
    console.log(
        `  dates: ${balances.rows} (${balances.startDate} to ${balances.endDate})`,
    )
    console.log(`  accounts: ${payload.accounts.length}`)
    console.log(`  balance entries: ${balances.balanceRows}`)
    console.log(`  skipped blank card cells: ${balances.blankCardCells}`)
    console.log(`  explicit zero card cells: ${balances.explicitZeroCardCells}`)
    console.log(
        `  checking baseline: ${formatCents(payload.settings.checkingBaselineCents)}`,
    )
    console.log(
        `  emergency baseline: ${formatCents(payload.settings.emergencyBaselineCents)}`,
    )
    console.log(
        `  excess split: ${payload.settings.excessInvestPct}/${payload.settings.excessSavePct}`,
    )
    console.log(`  default window: ${payload.settings.defaultWindow} weeks`)
}

const main = async () => {
    const args = parseArgs(process.argv.slice(2))
    const numbersFile = assertRequiredNumbersFile(args.file)
    const exportDir = exportNumbers(numbersFile)

    try {
        await runImport(args, exportDir)
    } finally {
        rmSync(exportDir, {force: true, recursive: true})
    }
}

await main()
