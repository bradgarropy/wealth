import {data, useFetcher} from "react-router"

import MoneyInput from "~/components/MoneyInput"
import NumberInput from "~/components/NumberInput"
import {Button} from "~/components/ui/button"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "~/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import {getDatabaseFromContext} from "~/db/client"
import {getSettings, setSettings} from "~/db/queries"
import {defaultWindows} from "~/db/schema"
import {settingsActionSchema} from "~/schemas/settings"
import {createRelease} from "~/utils/sentry"

import type {Route} from "./+types/settings"

export const action = async ({context, request}: Route.ActionArgs) => {
    const formData = await request.formData()
    const result = settingsActionSchema.safeParse(Object.fromEntries(formData))

    if (!result.success) {
        return data(
            {
                error: "Check the settings and make sure the savings split totals 100%.",
                ok: false,
            },
            {status: 400},
        )
    }

    try {
        await setSettings(getDatabaseFromContext(context), result.data)
    } catch {
        return data(
            {error: "Unable to save settings. Try again.", ok: false},
            {status: 500},
        )
    }

    return {error: null, ok: true}
}

export const loader = async ({context}: Route.LoaderArgs) => {
    const settings = await getSettings(getDatabaseFromContext(context))

    if (!settings) {
        throw data("Settings are not configured.", {status: 500})
    }

    return {settings}
}

const Route = ({loaderData}: Route.ComponentProps) => {
    const fetcher = useFetcher<typeof action>()
    const {settings} = loaderData
    const isSaving = fetcher.state !== "idle"

    return (
        <>
            <title>wealth | settings</title>

            <main className="mx-auto w-full max-w-3xl py-8 sm:py-16">
                <div className="mb-10 space-y-2">
                    <h1 className="text-3xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">
                        Defaults used for weekly recommendations and reporting.
                    </p>
                </div>

                <fetcher.Form method="post" className="space-y-12">
                    <section aria-labelledby="cash-baselines-heading">
                        <div className="mb-6 space-y-1">
                            <h2
                                className="text-xl font-semibold"
                                id="cash-baselines-heading"
                            >
                                Cash baselines
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Amounts reserved before moving excess cash.
                            </p>
                        </div>

                        <FieldGroup className="sm:grid sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="checking-baseline">
                                    Checking baseline
                                </FieldLabel>
                                <MoneyInput
                                    defaultValue={
                                        settings.checkingBaselineCents / 100
                                    }
                                    id="checking-baseline"
                                    name="checkingBaselineCents"
                                />
                                <FieldDescription>
                                    Cash left in checking after weekly payments
                                    and transfers.
                                </FieldDescription>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="emergency-baseline">
                                    Emergency baseline
                                </FieldLabel>
                                <MoneyInput
                                    defaultValue={
                                        settings.emergencyBaselineCents / 100
                                    }
                                    id="emergency-baseline"
                                    name="emergencyBaselineCents"
                                />
                                <FieldDescription>
                                    Target balance for the emergency account.
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </section>

                    <section aria-labelledby="savings-split-heading">
                        <div className="mb-6 space-y-1">
                            <h2
                                className="text-xl font-semibold"
                                id="savings-split-heading"
                            >
                                Excess split
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Percentages must total 100%.
                            </p>
                        </div>

                        <FieldGroup className="sm:grid sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="investment-percentage">
                                    Investments
                                </FieldLabel>
                                <NumberInput
                                    addon="%"
                                    addonAlign="inline-end"
                                    defaultValue={settings.excessInvestPct}
                                    format={{maximumFractionDigits: 0}}
                                    id="investment-percentage"
                                    max={100}
                                    min={0}
                                    name="excessInvestPct"
                                    step={1}
                                />
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="savings-percentage">
                                    Savings
                                </FieldLabel>
                                <NumberInput
                                    addon="%"
                                    addonAlign="inline-end"
                                    defaultValue={settings.excessSavePct}
                                    format={{maximumFractionDigits: 0}}
                                    id="savings-percentage"
                                    max={100}
                                    min={0}
                                    name="excessSavePct"
                                    step={1}
                                />
                            </Field>
                        </FieldGroup>
                    </section>

                    <section aria-labelledby="reporting-heading">
                        <div className="mb-6 space-y-1">
                            <h2
                                className="text-xl font-semibold"
                                id="reporting-heading"
                            >
                                Reporting
                            </h2>
                        </div>

                        <FieldGroup className="sm:grid sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="default-window">
                                    Default window
                                </FieldLabel>
                                <Select
                                    defaultValue={String(
                                        settings.defaultWindow,
                                    )}
                                    name="defaultWindow"
                                >
                                    <SelectTrigger
                                        className="w-full px-4 text-lg data-[size=default]:h-14"
                                        id="default-window"
                                    >
                                        <SelectValue>
                                            {(value: string | null) =>
                                                value ? `${value} weeks` : null
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent alignItemWithTrigger={false}>
                                        {defaultWindows.map(window => (
                                            <SelectItem
                                                key={window}
                                                value={String(window)}
                                            >
                                                {window} weeks
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldDescription>
                                    Initial range for growth and average views.
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </section>

                    <div className="flex items-center justify-between gap-4 border-t pt-6">
                        <div aria-live="polite">
                            {fetcher.data?.error ? (
                                <FieldError>{fetcher.data.error}</FieldError>
                            ) : fetcher.data?.ok ? (
                                <p className="text-sm text-muted-foreground">
                                    Settings saved.
                                </p>
                            ) : null}
                        </div>

                        <Button disabled={isSaving} type="submit">
                            {isSaving ? "Saving..." : "Save settings"}
                        </Button>
                    </div>
                </fetcher.Form>

                <section
                    aria-labelledby="about-heading"
                    className="mt-16 border-t pt-8"
                >
                    <h2
                        className="mb-5 text-lg font-semibold"
                        id="about-heading"
                    >
                        About
                    </h2>

                    <div className="flex items-start justify-between gap-4 text-sm text-muted-foreground">
                        <a
                            aria-label="Built by Brad Garropy"
                            className="flex w-fit items-center gap-1.5 font-medium transition-colors hover:text-foreground"
                            href="https://bradgarropy.com"
                            rel="noreferrer"
                            target="_blank"
                        >
                            <span>Built by</span>
                            <span
                                aria-hidden="true"
                                className="size-5 bg-current mask-[url('/bg.svg')] mask-center mask-no-repeat mask-contain"
                            />
                        </a>

                        <div className="flex flex-col items-end gap-1">
                            <a
                                className="flex items-center gap-1.5 font-medium transition-colors hover:text-foreground"
                                href="https://github.com/bradgarropy/wealth"
                                rel="noreferrer"
                                target="_blank"
                            >
                                <span
                                    aria-hidden="true"
                                    className="size-4 bg-current mask-[url('/github.svg')] mask-center mask-no-repeat mask-contain"
                                />
                                GitHub
                            </a>
                            <span className="text-xs">{createRelease()}</span>
                        </div>
                    </div>
                </section>
            </main>
        </>
    )
}

export default Route
