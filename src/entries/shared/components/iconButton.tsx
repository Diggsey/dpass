import { FC, ReactNode, MouseEvent } from "react"
import { ClassName, cn } from "../ui"

type IconButtonProps = {
    className?: ClassName
    iconSizeClass?: ClassName
    iconClass?: ClassName
    iconSide?: "left" | "right"
    disabled?: boolean
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    children?: ReactNode
}

export const IconButton: FC<IconButtonProps> = ({
    className,
    iconSizeClass,
    iconClass,
    iconSide = "left",
    disabled,
    onClick,
    children,
}) => (
    <button
        type="button"
        className={cn("button", className)}
        disabled={disabled}
        onClick={onClick}
    >
        {iconSide === "left" ? (
            <span className={cn("icon", iconSizeClass)}>
                <i className={cn(iconClass)} />
            </span>
        ) : null}
        <span>{children}</span>
        {iconSide === "right" ? (
            <span className={cn("icon", iconSizeClass)}>
                <i className={cn(iconClass)} />
            </span>
        ) : null}
    </button>
)
