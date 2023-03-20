import { FC, useEffect, useState } from "react"
import { ClassName, cn } from "../ui"

type RelativeDateProps = {
    timestamp: number
    className?: ClassName
}

const INTERVALS: [number, string | null][] = [
    [1000 * 60 * 60 * 24 * 7 * 4, null],
    [1000 * 60 * 60 * 24 * 7, "week"],
    [1000 * 60 * 60 * 24, "day"],
    [1000 * 60 * 60, "hour"],
    [1000 * 60, "minute"],
    [1000, "second"],
]

function computeInterval(date: Date): [string, number | null] {
    const currentTs = Date.now()
    const delta = currentTs - date.getTime()
    for (const [v, name] of INTERVALS) {
        if (delta >= v) {
            if (name === null) {
                return [date.toLocaleDateString(), null]
            } else {
                const n = Math.floor(delta / v)
                const expiry = (n + 1) * v + date.getTime()
                const plural = n > 1 ? "s" : ""
                return [`${n} ${name}${plural} ago`, expiry]
            }
        }
    }
    return ["Just now", date.getTime() + 1000]
}

export const RelativeDate: FC<RelativeDateProps> = ({
    timestamp,
    className,
}) => {
    const date = new Date(timestamp)
    const [text, expiry] = computeInterval(date)
    const [_count, setCount] = useState(0)
    useEffect(() => {
        const timeoutId =
            expiry !== null
                ? setTimeout(
                      () => setCount((count) => count + 1),
                      expiry - Date.now()
                  )
                : null
        return () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId)
            }
        }
    }, [expiry])

    return (
        <span className={cn(className)} title={date.toLocaleString()}>
            {text}
        </span>
    )
}
