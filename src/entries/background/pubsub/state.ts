import { PrivilegedState } from "~/entries/shared/privileged/state";

export interface IStatePublisher extends EventTarget {
    publishPrivileged(state: PrivilegedState): void
}