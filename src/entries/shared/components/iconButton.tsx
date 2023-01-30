import { FunctionalComponent } from "preact";
import { ClassName, cn } from "../ui";

type IconButtonProps = {
    class?: ClassName,
    iconSizeClass?: ClassName,
    iconClass?: ClassName,
    disabled?: boolean,
    onClick?: (e: MouseEvent) => void,
}

export const IconButton: FunctionalComponent<IconButtonProps> = ({
    "class": className, iconSizeClass, iconClass, disabled, onClick, children
}) => (
    <button class={cn("button", className)} disabled={disabled} onClick={onClick}>
        <span class={cn("icon", iconSizeClass)}>
            <i class={cn(iconClass)} />
        </span>
        <span>{children}</span>
    </button>
)