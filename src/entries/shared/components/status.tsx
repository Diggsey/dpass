import { FunctionalComponent } from "preact";
import { cn } from "../ui";

type StatusProps = {
    level: "loading" | "info" | "success" | "warning" | "danger",
    colorText?: boolean,
}

export const Status: FunctionalComponent<StatusProps> = ({ level, colorText, children }) => {
    const colorClass = cn({
        hasTextInfo: level === "info",
        hasTextSuccess: level === "success",
        hasTextWarning: level === "warning",
        hasTextDanger: level === "danger",
    })
    const iconClass = cn({
        fas: level !== "loading",
        loader: level === "loading",
        faInfoCircle: level === "info",
        faCheckSquare: level === "success",
        faExclamationTriangle: level === "warning",
        faBan: level === "danger",
    })
    return <div class={cn("icon-text", colorText && colorClass)}>
        <span class={cn("icon", !colorText && colorClass)}>
            <i class={iconClass}></i>
        </span>
        <span>{children}</span>
    </div>
}