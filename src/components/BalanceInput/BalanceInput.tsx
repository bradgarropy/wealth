import {Field as FieldPrimitive} from "@base-ui/react/field"

import MoneyInput from "~/components/MoneyInput"
import {Badge} from "~/components/ui/badge"
import {Field, FieldError, FieldLabel} from "~/components/ui/field"
import type {Account} from "~/db/queries"
import {formatMoneyParts} from "~/utils/format"

type BalanceAccount = Pick<Account, "category" | "id" | "name" | "type">

type BalanceInputProps = {
    account: BalanceAccount
    onValueChange: (value: number | null) => void
    previousValue: number | null
    value: number | null
}

const BalanceInput = ({
    account,
    onValueChange,
    previousValue,
    value,
}: BalanceInputProps) => {
    const inputId = `account-${account.id}`
    const placeholder =
        previousValue === null
            ? undefined
            : formatMoneyParts(Math.round(previousValue * 100)).amount

    return (
        <>
            <div className="space-y-3">
                <h1 className="text-3xl font-bold">
                    What is the current balance?
                </h1>

                <div className="flex items-center justify-between gap-4">
                    <p className="text-xl font-semibold">{account.name}</p>

                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                            {account.category}
                        </Badge>

                        <Badge variant="outline" className="capitalize">
                            {account.type}
                        </Badge>
                    </div>
                </div>
            </div>

            <FieldPrimitive.Root name={inputId} render={<Field />}>
                <MoneyInput
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- Balance entry is the primary task on this wizard step.
                    autoFocus
                    id={inputId}
                    placeholder={placeholder}
                    value={value}
                    onValueChange={onValueChange}
                />

                <FieldPrimitive.Label
                    render={
                        <FieldLabel
                            htmlFor={inputId}
                            className="order-first ml-auto text-right"
                        />
                    }
                >
                    Current balance
                </FieldPrimitive.Label>

                <FieldPrimitive.Error render={<FieldError />}>
                    Enter a balance.
                </FieldPrimitive.Error>
            </FieldPrimitive.Root>
        </>
    )
}

export default BalanceInput
