import { useEffect, useMemo, useState } from "react"
import { TIMER_WHEEL, TimeView, ceilTime } from "../../time"

function useTime<T>(view: TimeView<T>, inputs?: React.DependencyList): T {
    const [timestamp, setTimestamp] = useState(ceilTime)
    const { current, expires } = useMemo(
        () => view(timestamp),
        [timestamp, ...(inputs ?? [])]
    )

    useEffect(
        () =>
            TIMER_WHEEL.add(expires, (ts) => {
                setTimestamp(ts)
            }),
        [expires]
    )

    return current
}

export default useTime
