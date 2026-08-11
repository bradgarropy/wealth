import NumberInput from "~/components/NumberInput"

type MoneyInputProps = {
    ariaLabel?: string
    className?: string
    defaultValue?: number
    id: string
    name?: string
    onValueChange?: (value: number | null) => void
    value?: number | null
}

const MoneyInput = ({
    ariaLabel,
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
