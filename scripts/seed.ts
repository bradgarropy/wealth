import {format, startOfWeek, subWeeks} from "date-fns"
import {sql} from "drizzle-orm"
import {getPlatformProxy} from "wrangler"

import {ACCOUNT} from "~/constants"
import {getDatabase} from "~/db/client"
import type {AccountInput} from "~/db/queries"
import {
    getAccounts,
    setSettings,
    upsertAccounts,
    upsertBalances,
} from "~/db/queries"
import {accounts, balances, settings} from "~/db/schema"

const demoAccounts = [
    {
        archived: false,
        category: "credit",
        name: "NFCU Credit",
        sortOrder: 10,
        type: "liability",
    },
    {
        archived: true,
        category: "credit",
        name: "Apple",
        sortOrder: 15,
        type: "liability",
    },
    {
        archived: false,
        category: "cash",
        name: ACCOUNT.CHECKING,
        sortOrder: 20,
        type: "asset",
    },
    {
        archived: false,
        category: "savings",
        name: ACCOUNT.EMERGENCY,
        sortOrder: 30,
        type: "asset",
    },
    {
        archived: false,
        category: "savings",
        name: ACCOUNT.SAVINGS,
        sortOrder: 40,
        type: "asset",
    },
    {
        archived: false,
        category: "retirement",
        name: "401k",
        sortOrder: 50,
        type: "asset",
    },
    {
        archived: false,
        category: "investment",
        name: "HSA",
        sortOrder: 60,
        type: "asset",
    },
    {
        archived: false,
        category: "investment",
        name: ACCOUNT.INVESTMENT,
        sortOrder: 70,
        type: "asset",
    },
    {
        archived: false,
        category: "mortgage",
        name: "Mortgage",
        sortOrder: 80,
        type: "liability",
    },
] satisfies AccountInput[]

const balanceGenerators: Record<string, (week: number) => number> = {
    "NFCU Credit": week => 85_000 + ((week * 43_700) % 140_000),
    "Apple": week => (week < 12 ? 25_000 + ((week * 17_300) % 65_000) : 0),
    [ACCOUNT.CHECKING]: week =>
        2_200_000 + [310_000, 75_000, 420_000, 190_000][week % 4],
    [ACCOUNT.EMERGENCY]: () => 6_000_000,
    [ACCOUNT.SAVINGS]: week => 1_200_000 + week * 15_000,
    "401k": week => 12_000_000 + week * 60_000 + (week % 5) * 45_000,
    "HSA": week => 650_000 + week * 7_500,
    [ACCOUNT.INVESTMENT]: week =>
        8_800_000 + week * 100_000 + (week % 6) * 80_000,
    "Mortgage": week => 15_800_000 - week * 57_500,
}

const captureCount = 104
const captureDates = Array.from({length: captureCount}, (_, week) => {
    const latestSunday = startOfWeek(new Date(), {weekStartsOn: 0})
    return format(subWeeks(latestSunday, captureCount - 1 - week), "yyyy-MM-dd")
})

const platform = await getPlatformProxy<Env>({remoteBindings: false})

try {
    const db = getDatabase(platform.env)

    await db.delete(balances)
    await db.delete(accounts)
    await db.delete(settings)
    await db.run(
        sql`delete from sqlite_sequence where name in ('accounts', 'balances')`,
    )

    console.log("Reset local database.")

    await setSettings(db, {
        checkingBaselineCents: 2_000_000,
        defaultWindow: 52,
        emergencyBaselineCents: 6_000_000,
        excessInvestPct: 75,
        excessSavePct: 25,
    })

    await upsertAccounts(db, demoAccounts)

    const seededAccounts = await getAccounts(db)
    const accountIds = new Map(
        seededAccounts.map(account => [account.name, account.id]),
    )

    for (const [week, date] of captureDates.entries()) {
        const entries = demoAccounts.map(account => {
            const accountId = accountIds.get(account.name)
            const generateBalance = balanceGenerators[account.name]

            if (!accountId || !generateBalance) {
                throw new Error(`Unable to seed ${account.name}.`)
            }

            return {
                accountId,
                amountCents: generateBalance(week),
            }
        })

        await upsertBalances(db, date, entries)
    }

    console.log(
        `Seeded ${demoAccounts.length} demo accounts and ${captureDates.length} weekly captures locally.`,
    )
} finally {
    await platform.dispose()
}
