import { FC } from "react"
import { DetailsPanel } from "~/entries/options/identity/details"
import { UnlockPanel } from "~/entries/shared/components/unlockForm"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { StorageAddresses } from "../storage/addresses"
import { SetupPanel } from "./setup"

export const IdentityPage: FC<{ state: PrivilegedState }> = ({ state }) => {
    const storagePanel = (
        <StorageAddresses
            name="identity"
            vaultId={null}
            addresses={state.rootAddresses}
            syncState={state.syncState}
        />
    )
    const unlockPanel = state.hasIdentity && !state.isUnlocked && (
        <UnlockPanel isSetUp={state.isSetUp} isUnlocked={false} />
    )
    const lockPanel = state.hasIdentity &&
        state.isUnlocked &&
        state.rootInfo && <DetailsPanel rootInfo={state.rootInfo} />
    const setupPanel = state.rootAddresses.length > 0 && !state.hasIdentity && (
        <SetupPanel />
    )
    return (
        <div className="overflow-y-auto overflow-x-hidden [container-type:size]">
            <div className="sm:mr-[calc(100%_-_100cqw)]">
                <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 py-10 gap-10 auto-rows-max">
                    {storagePanel}
                    {unlockPanel}
                    {lockPanel}
                    {setupPanel}
                </div>
            </div>
        </div>
    )
}
