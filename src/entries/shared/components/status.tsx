import { FC, ReactNode } from "react"
import { cn } from "../ui"

type StatusProps = {
    level: "loading" | "info" | "success" | "warning" | "danger"
    colorText?: boolean
    children?: ReactNode
}

export const Status: FC<StatusProps> = ({ level, colorText, children }) => {
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
    return (
        <div className={cn("icon-text", colorText && colorClass)}>
            <span className={cn("icon", !colorText && colorClass)}>
                <i className={iconClass}></i>
            </span>
            <span>{children}</span>
        </div>
    )
}
