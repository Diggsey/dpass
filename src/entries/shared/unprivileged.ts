import { Subscriber } from "./pubsub"
import { UnprivilegedState, UNPRIVILEGED_PORT_NAME } from "./state"
import { useEffect, useState } from "react"

class UnprivilegedSubscriber extends Subscriber<UnprivilegedState> {
    constructor(origin?: string) {
        const portName = origin
            ? `${UNPRIVILEGED_PORT_NAME}/${origin}`
            : UNPRIVILEGED_PORT_NAME
        super(portName)
    }
}

export function useUnprivilegedState(
    origin?: string
): UnprivilegedState | null {
    const [state, setState] = useState<UnprivilegedState | null>(null)
    useEffect(() => {
        const subscriber = new UnprivilegedSubscriber(origin)
        subscriber.addEventListener("update", () =>
            setState(subscriber.currentValue)
        )
        return () => {
            subscriber.dispose()
        }
    }, [])
    return state
}
