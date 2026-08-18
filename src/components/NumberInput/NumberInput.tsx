import {NumberField} from "@base-ui/react/number-field"
import type {ReactNode} from "react"

import {
    InputGroup,
    InputGroupAddon,
    InputGroupText,
} from "~/components/ui/input-group"
import {cn} from "~/lib/utils"

type NumberInputProps = {
    addon?: ReactNode
    addonAlign?: "inline-start" | "inline-end"
    ariaLabel?: string
    autoFocus?: boolean
    className?: string
    defaultValue?: number
    format?: Intl.NumberFormatOptions
    id: string
    max?: number
    min?: number
    name?: string
    onValueChange?: (value: number | null) => void
    step?: number
    value?: number | null
}

const NumberInput = ({
    addon,
    addonAlign = "inline-start",
    ariaLabel,
    autoFocus,
    className,
    defaultValue,
    format,
    id,
    max,
    min,
    name,
    onValueChange,
    step,
    value,
}: NumberInputProps) => {
    return (
        <NumberField.Root
            required
            defaultValue={defaultValue}
            format={format}
            max={max}
            min={min}
            name={name}
            step={step}
            value={value}
            onValueChange={onValueChange}
        >
            <NumberField.Group
                render={<InputGroup className={cn("h-14", className)} />}
            >
                <NumberField.Input
                    aria-label={ariaLabel}
                    // eslint-disable-next-line jsx-a11y/no-autofocus -- Enabled explicitly for wizard input focus.
                    autoFocus={autoFocus}
                    id={id}
                    data-slot="input-group-control"
                    className="h-full min-w-0 flex-1 bg-transparent px-4 text-right text-lg tabular-nums outline-none"
                />

                {addon ? (
                    <InputGroupAddon align={addonAlign}>
                        <InputGroupText className="text-lg">
                            {addon}
                        </InputGroupText>
                    </InputGroupAddon>
                ) : null}
            </NumberField.Group>
        </NumberField.Root>
    )
}

export default NumberInput
