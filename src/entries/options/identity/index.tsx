import { FunctionalComponent } from "preact"
import { LockPanel } from "~/entries/shared/components/lockForm"
import { UnlockPanel } from "~/entries/shared/components/unlockForm"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { IdentityStoragePanel } from "./storage"

export const IdentityPage: FunctionalComponent<{ state: PrivilegedState }> = ({
    state,
}) => {
    const storagePanel = <IdentityStoragePanel state={state} />
    const unlockPanel = state.hasIdentity && !state.isUnlocked && (
        <UnlockPanel isSetUp={state.isSetUp} isUnlocked={false} />
    )
    const lockPanel = state.hasIdentity &&
        state.isUnlocked &&
        state.rootInfo && <LockPanel rootInfo={state.rootInfo} />
    return (
        <>
            {storagePanel}
            {unlockPanel}
            {lockPanel}
        </>
    )
}
