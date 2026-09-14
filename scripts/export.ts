import {mkdirSync, statSync, writeFileSync} from "node:fs"
import path from "node:path"
import {fileURLToPath} from "node:url"

import {stringify} from "csv-stringify/sync"
import {format, parseISO} from "date-fns"
import {getPlatformProxy} from "wrangler"

import {getDatabaseFromEnv} from "~/db/client"
import type {Account, Settings} from "~/db/queries"
import {getAccounts, getAllBalances, getSettings} from "~/db/queries"

type Args = {
    dir?: string
    remote: boolean
}

type ExportBalance = Awaited<ReturnType<typeof getAllBalances>>[number]

const ACCOUNTS_FILE_NAME = "Accounts.csv"
const BALANCES_FILE_NAME = "Balances.csv"
const SETTINGS_FILE_NAME = "Settings.csv"

const moneyFormatter = new Intl.NumberFormat("en-US", {
    currency: "USD",
    currencySign: "accounting",
    minimumFractionDigits: 2,
    style: "currency",
})

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
)

const parseArgs = (argv: string[]): Args => {
    const args: Args = {remote: false}

    for (const arg of argv) {
        if (arg === "--remote") {
            args.remote = true
            continue
        }

        if (arg.startsWith("--")) {
            throw new Error(`Unknown option: ${arg}`)
        }

        if (args.dir) {
            throw new Error(`Unexpected argument: ${arg}`)
        }

        args.dir = arg
    }

    return args
}

const getExportDirectory = (value?: string) => {
    if (!value) {
        throw new Error("Missing required dir path.")
    }

    const resolved = path.resolve(value)
    const relative = path.relative(repoRoot, resolved)

    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
        throw new Error(
            `The export directory must live outside the repository: ${resolved}`,
        )
    }

    mkdirSync(resolved, {recursive: true})

    if (!statSync(resolved).isDirectory()) {
        throw new Error(`The export path must be a directory: ${resolved}`)
    }

    return resolved
}

const formatCents = (amountCents: number, negative = false) => {
    const amount = amountCents / 100

    return moneyFormatter.format(negative ? -amount : amount)
}

const indexBalancesByDate = (balances: ExportBalance[]) => {
    const balancesByDate = new Map<string, Map<string, number>>()

    for (const balance of balances) {
        const balancesByAccount =
            balancesByDate.get(balance.date) ?? new Map<string, number>()

        balancesByAccount.set(balance.accountName, balance.amountCents)
        balancesByDate.set(balance.date, balancesByAccount)
    }

    return balancesByDate
}

const buildBalanceCsv = (accounts: Account[], balances: ExportBalance[]) => {
    const balancesByDate = indexBalancesByDate(balances)
    const columns = ["Date", ...accounts.map(account => account.name)]
    const rows = [...balancesByDate].map(([date, balancesByAccount]) => {
        return Object.fromEntries([
            ["Date", format(parseISO(date), "MM/dd/yyyy")],
            ...accounts.map(account => {
                const amountCents = balancesByAccount.get(account.name)

                if (amountCents === undefined) {
                    return [account.name, ""]
                }

                return [
                    account.name,
                    formatCents(amountCents, account.type === "liability"),
                ]
            }),
        ])
    })

    return {
        contents: stringify(rows, {columns, header: true}),
        dates: [...balancesByDate.keys()],
    }
}

const buildAccountsCsv = (accounts: Account[]) => {
    return stringify(
        accounts.map(account => ({
            "Archived": account.archived,
            "Category": account.category,
            "Name": account.name,
            "Sort Order": account.sortOrder,
            "Type": account.type,
        })),
        {
            columns: ["Name", "Type", "Category", "Sort Order", "Archived"],
            header: true,
        },
    )
}

const buildSettingsCsv = (settings: Settings) => {
    return stringify(
        [
            {
                "Balance Convention": "pre-payoff",
                "Checking Baseline": formatCents(
                    settings.checkingBaselineCents,
                ),
                "Default Window": settings.defaultWindow,
                "Emergency Baseline": formatCents(
                    settings.emergencyBaselineCents,
                ),
                "Excess Invest Percent": settings.excessInvestPct,
                "Excess Save Percent": settings.excessSavePct,
                "Format Version": 1,
            },
        ],
        {
            columns: [
                "Format Version",
                "Balance Convention",
                "Checking Baseline",
                "Emergency Baseline",
                "Excess Invest Percent",
                "Excess Save Percent",
                "Default Window",
            ],
            header: true,
        },
    )
}

const main = async () => {
    const args = parseArgs(process.argv.slice(2))
    const exportDirectory = getExportDirectory(args.dir)
    const platform = await getPlatformProxy<Env>({
        remoteBindings: args.remote,
    })

    try {
        const db = getDatabaseFromEnv(platform.env)
        const [accounts, balances, settings] = await Promise.all([
            getAccounts(db),
            getAllBalances(db),
            getSettings(db),
        ])

        if (!settings) {
            throw new Error("Settings have not been configured.")
        }

        if (accounts.length === 0) {
            throw new Error("No accounts found.")
        }

        const balanceExport = buildBalanceCsv(accounts, balances)
        const accountsPath = path.join(exportDirectory, ACCOUNTS_FILE_NAME)
        const balancesPath = path.join(exportDirectory, BALANCES_FILE_NAME)
        const settingsPath = path.join(exportDirectory, SETTINGS_FILE_NAME)

        writeFileSync(accountsPath, buildAccountsCsv(accounts), "utf8")
        writeFileSync(balancesPath, balanceExport.contents, "utf8")
        writeFileSync(settingsPath, buildSettingsCsv(settings), "utf8")

        const heading = args.remote
            ? "Remote export complete"
            : "Local export complete"
        const startDate = balanceExport.dates.at(0) ?? "none"
        const endDate = balanceExport.dates.at(-1) ?? "none"

        console.log(heading)
        console.log(
            `  accounts: ${ACCOUNTS_FILE_NAME} (${accounts.length} rows)`,
        )
        console.log(
            `  balances: ${BALANCES_FILE_NAME} (${balanceExport.dates.length} rows)`,
        )
        console.log(`  settings: ${SETTINGS_FILE_NAME} (1 row)`)
        console.log(`  dates: ${startDate} to ${endDate}`)
        console.log(`  directory: ${exportDirectory}`)
    } finally {
        await platform.dispose()
    }
}

await main()
