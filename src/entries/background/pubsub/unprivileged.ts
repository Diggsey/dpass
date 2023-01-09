import { Runtime } from "webextension-polyfill";
import { mapObjectValues } from "~/entries/shared";
import { PrivilegedState, PrivilegedSyncState, PrivilegedVault } from "~/entries/shared/privileged/state";
import { Publisher } from "~/entries/shared/pubsub";
import { UnprivilegedState, UnprivilegedSyncState, UnprivilegedVault } from "~/entries/shared/state";
import { IStatePublisher } from "./state";

export class UnprivilegedPublisher extends Publisher<UnprivilegedState> implements IStatePublisher {
    #origin: string
    constructor(origin: string, port: Runtime.Port) {
        super(port)
        this.#origin = origin
    }
    publishPrivileged(state: PrivilegedState): void {
        this.publish(this.convertState(state))
    }
    convertState(state: PrivilegedState): UnprivilegedState {
        return {
            privileged: false,
            origin: this.#origin,
            hasRoot: state.hasRoot,
            syncState: this.convertSyncState(state.syncState),
            vaults: mapObjectValues(state.vaults, v => this.convertVault(v))
        }
    }
    convertSyncState(syncState: PrivilegedSyncState): UnprivilegedSyncState {
        const syncValues = Object.values(syncState)
        if (syncValues.some(v => v.lastError)) {
            return "error"
        } else if (syncValues.some(v => v.lastWarning)) {
            return "warning"
        } else if (syncValues.some(v => v.inProgress)) {
            return "inProgress"
        } else {
            return "idle"
        }
    }
    convertVault(vault: PrivilegedVault): UnprivilegedVault {
        return {
            name: vault.name,
            items: vault.items,
            syncState: this.convertSyncState(vault.syncState)
        }
    }
}