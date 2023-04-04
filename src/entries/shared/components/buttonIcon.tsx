import { ComponentPropsWithRef } from "react"
import { cn, ElementTypeWithProps } from "../ui"

type IconComponentType = ElementTypeWithProps<{
    className: string
    "aria-hidden": "true"
}>

type ButtonIconProps<Icon extends IconComponentType> =
    ComponentPropsWithRef<Icon> & {
        icon: IconComponentType
    }

export const ButtonIcon = <Icon extends IconComponentType>({
    icon: Icon,
    className,
    ...props
}: ButtonIconProps<Icon>) => (
    <Icon
        className={cn("first:-ml-0.5 last:-mr-0.5 h-5 w-5 shrink-0", className)}
        aria-hidden="true"
        {...props}
    />
)
