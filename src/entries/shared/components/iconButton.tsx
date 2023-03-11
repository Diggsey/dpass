import { FunctionalComponent } from "preact"
import { ClassName, cn } from "../ui"

type IconButtonProps = {
    class?: ClassName
    iconSizeClass?: ClassName
    iconClass?: ClassName
    iconSide?: "left" | "right"
    disabled?: boolean
    onClick?: (e: MouseEvent) => void
}

export const IconButton: FunctionalComponent<IconButtonProps> = ({
    class: className,
    iconSizeClass,
    iconClass,
    iconSide = "left",
    disabled,
    onClick,
    children,
}) => (
    <button
        type="button"
        class={cn("button", className)}
        disabled={disabled}
        onClick={onClick}
    >
        {iconSide === "left" ? (
            <span class={cn("icon", iconSizeClass)}>
                <i class={cn(iconClass)} />
            </span>
        ) : null}
        <span>{children}</span>
        {iconSide === "right" ? (
            <span class={cn("icon", iconSizeClass)}>
                <i class={cn(iconClass)} />
            </span>
        ) : null}
    </button>
)
