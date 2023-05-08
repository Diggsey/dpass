import { FC } from "react"
import { ClassName, cn } from "../ui"
import { relativeDateView } from "../time"
import { useTime } from "../ui/hooks"

type RelativeDateProps = {
    timestamp: number
    className?: ClassName
}

export const RelativeDate: FC<RelativeDateProps> = ({
    timestamp,
    className,
}) => {
    const date = new Date(timestamp)
    const text = useTime(relativeDateView(timestamp), [timestamp])

    return (
        <span className={cn(className)} title={date.toLocaleString()}>
            {text}
        </span>
    )
}
