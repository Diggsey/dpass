import { FunctionalComponent } from "preact"
import { UnlockPanel } from "~/entries/shared/components/unlockForm"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { StoragePanel } from "./storage"

export const IdentityPage: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
    const storagePanel = <StoragePanel state={state} />
    const unlockPanel = state.hasIdentity && !state.isUnlocked && <UnlockPanel />
    return <>
        {storagePanel}
        {unlockPanel}
    </>
}