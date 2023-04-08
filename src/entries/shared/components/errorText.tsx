import { ReactNode } from "react"
import { ClassName, cn } from "../ui"

interface AnyPromiseState {
    readonly lastError?: unknown
}

type ErrorTextProps = {
    show?: boolean
    state?: AnyPromiseState
    children?: ReactNode
    className?: ClassName
}
export const ErrorText = ({
    show,
    state,
    children,
    className,
}: ErrorTextProps) => {
    const lastError = state?.lastError
    const visible = show || lastError
    const message = children || lastError?.toString() || "Unknown error"
    return visible ? (
        <p className={cn("text-red-600 text-sm mt-3", className)}>{message}</p>
    ) : null
}
