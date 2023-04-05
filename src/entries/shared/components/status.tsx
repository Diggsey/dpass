import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
} from "@heroicons/react/24/outline"
import { FC, ReactNode } from "react"
import { cn } from "../ui"
import { Loader } from "./icons/loader"

type StatusProps = {
    level: "loading" | "info" | "success" | "warning" | "danger"
    colorText?: boolean
    children?: ReactNode
}

const iconComponents = {
    loading: Loader,
    info: InformationCircleIcon,
    success: CheckCircleIcon,
    warning: ExclamationTriangleIcon,
    danger: ExclamationCircleIcon,
}

const iconColors = {
    loading: "text-gray-400",
    info: "text-blue-400",
    success: "text-green-400",
    warning: "text-yellow-400",
    danger: "text-red-400",
}

const textColors = {
    loading: "text-gray-700",
    info: "text-blue-700",
    success: "text-green-700",
    warning: "text-yellow-700",
    danger: "text-red-700",
}

export const Status: FC<StatusProps> = ({ level, colorText, children }) => {
    const iconColor = iconColors[level]
    const textColor = colorText ? textColors[level] : ""
    const IconComponent = iconComponents[level]
    return (
        <span className="flex items-center gap-1">
            <IconComponent className={cn("w-5 h-5 shrink-0", iconColor)} />
            <span className={textColor}>{children}</span>
        </span>
    )
}
