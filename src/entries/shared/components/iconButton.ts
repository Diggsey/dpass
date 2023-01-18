import { FunctionalComponent } from "preact";
import { html } from "../render";
import { ClassName, cn } from "../ui";

type IconButtonProps = {
    class?: ClassName,
    iconSizeClass?: ClassName,
    iconClass?: ClassName,
    disabled?: boolean,
    onclick?: (e: MouseEvent) => void,
}

export const IconButton: FunctionalComponent<IconButtonProps> = ({
    "class": className, iconSizeClass, iconClass, disabled, onclick, children
}) => (html`
    <button class=${cn("button", className)} disabled=${disabled} onclick=${onclick}>
        <span class=${cn("icon", iconSizeClass)}>
            <i class=${cn(iconClass)} />
        </span>
        <span>${children}</span>
    </button>
`)