import {
    IStatePublisher,
    PrivilegedState,
} from "~/entries/shared/privileged/state"
import { Publisher } from "~/entries/shared/pubsub"

export class PrivilegedPublisher
    extends Publisher<PrivilegedState>
    implements IStatePublisher
{
    publishPrivileged(state: PrivilegedState): void {
        this.publish(state)
    }
}
