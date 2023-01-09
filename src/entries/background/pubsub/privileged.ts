import { PrivilegedState } from "~/entries/shared/privileged/state";
import { Publisher } from "~/entries/shared/pubsub";
import { IStatePublisher } from "./state";

export class PrivilegedPublisher extends Publisher<PrivilegedState> implements IStatePublisher {
    publishPrivileged(state: PrivilegedState): void {
        this.publish(state)
    }
}