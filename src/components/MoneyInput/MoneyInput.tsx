import NumberInput from "~/components/NumberInput"

type MoneyInputProps = {
    ariaLabel?: string
    autoFocus?: boolean
    className?: string
    defaultValue?: number
    id: string
    name?: string
    onValueChange?: (value: number | null) => void
    value?: number | null
}

const MoneyInput = ({
    ariaLabel,
    autoFocus,
    className,
    defaultValue,
    id,
    name,
    onValueChange,
    value,
}: MoneyInputProps) => {
    return (
        <NumberInput
            addon="$"
            ariaLabel={ariaLabel}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Forwarded explicitly for wizard input focus.
            autoFocus={autoFocus}
            className={className}
            defaultValue={defaultValue}
            format={{
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
                style: "decimal",
            }}
            id={id}
            min={0}
            name={name}
            step={0.01}
            value={value}
            onValueChange={onValueChange}
        />
    )
}

export default MoneyInput
