import { FC } from "react"
import { LockPanel } from "~/entries/shared/components/lockForm"
import { UnlockPanel } from "~/entries/shared/components/unlockForm"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { IdentityStoragePanel } from "./storage"

export const IdentityPage: FC<{ state: PrivilegedState }> = ({ state }) => {
    const storagePanel = <IdentityStoragePanel state={state} />
    const unlockPanel = state.hasIdentity && !state.isUnlocked && (
        <UnlockPanel isSetUp={state.isSetUp} isUnlocked={false} />
    )
    const lockPanel = state.hasIdentity &&
        state.isUnlocked &&
        state.rootInfo && <LockPanel rootInfo={state.rootInfo} />
    return (
        <div className="container mx-auto max-w-7xl sm:px-6 lg:px-8">
            {storagePanel}
            {unlockPanel}
            {lockPanel}
        </div>
    )
}
