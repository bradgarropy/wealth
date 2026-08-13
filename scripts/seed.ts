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

const captureCount = 104

const randomUnit = (week: number, salt: number) => {
    let value = Math.imul(week + 1, 0x6d2b79f5) ^ salt
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
}

const createMarketSeries = (
    startCents: number,
    endCents: number,
    weeklyVolatilityCents: number,
    salt: number,
) => {
    const randomWalk = [0]

    for (let week = 1; week < captureCount; week++) {
        const change = (randomUnit(week, salt) * 2 - 1) * weeklyVolatilityCents
        randomWalk.push(randomWalk[week - 1] + change)
    }

    const finalRandomWalk = randomWalk.at(-1) ?? 0

    return randomWalk.map((value, week) => {
        const progress = week / (captureCount - 1)
        const trend = startCents + (endCents - startCents) * progress
        const adjustedRandomWalk = value - finalRandomWalk * progress

        return Math.round(trend + adjustedRandomWalk)
    })
}

const createCheckingSeries = () => {
    const balances = [1_280_000]
    let weeksUntilPaycheck = 1

    for (let week = 1; week < captureCount; week++) {
        let balance = balances[week - 1]

        if (weeksUntilPaycheck === 0) {
            balance = 1_220_000 + Math.round(randomUnit(week, 101) * 210_000)
            weeksUntilPaycheck = randomUnit(week, 102) > 0.86 ? 2 : 1
        } else {
            const weeklyDrawdown =
                135_000 + Math.round(randomUnit(week, 103) * 105_000)
            balance = Math.max(700_000, balance - weeklyDrawdown)
            weeksUntilPaycheck--
        }

        balances.push(balance)
    }

    const adjustment = 1_000_000 - (balances.at(-1) ?? 0)

    return balances.map(balance => Math.max(650_000, balance + adjustment))
}

const createSavingsSeries = () => {
    const balances = [1_000_000]

    for (let week = 1; week < captureCount; week++) {
        const previous = balances[week - 1]
        const canDrawDown = week < captureCount - 18 && previous > 900_000
        const shouldDrawDown = randomUnit(week, 202) < 0.07
        let balance: number

        if (canDrawDown && shouldDrawDown) {
            balance =
                previous - 380_000 - Math.round(randomUnit(week, 203) * 100_000)
        } else if (previous < 1_000_000) {
            balance =
                previous + 15_000 + Math.round(randomUnit(week, 204) * 25_000)
        } else {
            const variation = Math.round(
                (randomUnit(week, 205) * 2 - 1) * 12_000,
            )
            balance = previous + variation
        }

        balances.push(Math.min(1_030_000, Math.max(500_000, balance)))
    }

    return balances
}

const checkingSeries = createCheckingSeries()
const savingsSeries = createSavingsSeries()
const retirementSeries = createMarketSeries(
    12_000_000,
    19_600_000,
    260_000,
    303,
)
const hsaSeries = createMarketSeries(650_000, 1_422_500, 24_000, 404)
const investmentSeries = createMarketSeries(8_800_000, 22_000_000, 380_000, 505)
const spendingSeries = Array.from({length: captureCount}, (_, week) => {
    if (week === captureCount - 1) return 87_500

    return Math.round(55_000 + randomUnit(week, 606) * 40_000)
})
const appleSpendingSeries = spendingSeries.map((totalCents, week) => {
    if (week >= 24) return 0

    const share = 0.25 + randomUnit(week, 607) * 0.2
    return Math.round(totalCents * share)
})
const nfcuSpendingSeries = spendingSeries.map(
    (totalCents, week) => totalCents - appleSpendingSeries[week],
)

const balanceGenerators: Record<string, (week: number) => number> = {
    "NFCU Credit": week => nfcuSpendingSeries[week],
    "Apple": week => appleSpendingSeries[week],
    [ACCOUNT.CHECKING]: week => checkingSeries[week],
    [ACCOUNT.EMERGENCY]: () => 5_000_000,
    [ACCOUNT.SAVINGS]: week => savingsSeries[week],
    "401k": week => retirementSeries[week],
    "HSA": week => hsaSeries[week],
    [ACCOUNT.INVESTMENT]: week => investmentSeries[week],
    "Mortgage": week => 15_800_000 - week * 57_500,
}

const captureDates = Array.from({length: captureCount}, (_, week) => {
    const latestSunday = startOfWeek(new Date(), {weekStartsOn: 0})
    return format(subWeeks(latestSunday, captureCount - 1 - week), "yyyy-MM-dd")
})

const seedDemo = process.argv.includes("--demo")
const unexpectedArguments = process.argv
    .slice(2)
    .filter((value: string) => value !== "--demo")

if (unexpectedArguments.length > 0) {
    throw new Error(`Unknown seed arguments: ${unexpectedArguments.join(", ")}`)
}

const platform = await getPlatformProxy<Env>({
    environment: seedDemo ? "demo" : undefined,
    remoteBindings: seedDemo,
})

try {
    const db = getDatabase(platform.env)

    await db.delete(balances)
    await db.delete(accounts)
    await db.delete(settings)
    await db.run(
        sql`delete from sqlite_sequence where name in ('accounts', 'balances')`,
    )

    console.log(`Reset ${seedDemo ? "remote demo" : "local"} database.`)

    await setSettings(db, {
        checkingBaselineCents: 1_000_000,
        defaultWindow: 52,
        emergencyBaselineCents: 5_000_000,
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
        `Seeded ${demoAccounts.length} demo accounts and ${captureDates.length} weekly captures ${seedDemo ? "to the remote demo" : "locally"}.`,
    )
} finally {
    await platform.dispose()
}
