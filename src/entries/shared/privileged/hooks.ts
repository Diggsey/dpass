import { useEffect, useState } from "preact/hooks";
import { Subscriber } from "../pubsub";
import { PrivilegedState, PRIVILEGED_PORT_NAME } from "./state";

class PrivilegedSubscriber extends Subscriber<PrivilegedState> {
    constructor() {
        super(PRIVILEGED_PORT_NAME);
    }
}

export function usePrivilegedState(): PrivilegedState | null {
    const [state, setState] = useState<PrivilegedState | null>(null)
    useEffect(() => {
        const subscriber = new PrivilegedSubscriber()
        subscriber.addEventListener("update", () => setState(subscriber.currentValue))
        return () => {
            subscriber.dispose()
        }
    }, [])
    return state
}
