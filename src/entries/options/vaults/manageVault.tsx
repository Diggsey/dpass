import { FC } from "react"
import { PrivilegedVault } from "~/entries/shared/privileged/state"
import { StorageAddresses } from "../storage/addresses"
import { TextButton } from "~/entries/shared/components/styledElem"
import { DetailsPanel } from "./details"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"

export const ManageVault: FC<{
    vaultId: string
    vault: PrivilegedVault
    isDefault: boolean
    close: () => void
}> = ({ vaultId, vault, isDefault, close }) => {
    return (
        <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 pb-10 auto-rows-max">
            <div className="px-3 py-5">
                <TextButton onClick={close}>
                    <ButtonIcon icon={ChevronLeftIcon} />
                    <span>Back to vaults</span>
                </TextButton>
            </div>
            <div className="grid gap-10">
                <StorageAddresses
                    name={vault.name}
                    vaultId={vaultId}
                    addresses={vault.addresses}
                    syncState={vault.syncState}
                />
                <DetailsPanel
                    vaultId={vaultId}
                    vault={vault}
                    isDefault={isDefault}
                />
            </div>
        </div>
    )
}
