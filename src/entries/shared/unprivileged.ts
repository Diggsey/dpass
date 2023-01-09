import { Subscriber } from "./pubsub";
import { UnprivilegedState, UNPRIVILEGED_PORT_NAME } from "./state";
import { useEffect, useState } from "preact/hooks"

class UnprivilegedSubscriber extends Subscriber<UnprivilegedState> {
    constructor() {
        super(UNPRIVILEGED_PORT_NAME);
    }
}

export function useUnprivilegedState(): UnprivilegedState | null {
    const [state, setState] = useState<UnprivilegedState | null>(null)
    useEffect(() => {
        const subscriber = new UnprivilegedSubscriber()
        subscriber.addEventListener("update", () => setState(subscriber.currentValue))
        return () => {
            subscriber.dispose()
        }
    }, [])
    return state
}
