import { FC } from "react"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { PrivilegedVault } from "~/entries/shared/privileged/state"
import { cn, usePromiseState, useSharedPromiseState } from "~/entries/shared/ui"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const VaultPanel: FC<{
    vaultId: string
    vault: PrivilegedVault
    isDefault: boolean
}> = ({ vaultId, vault, isDefault }) => {
    const panelClass = cn("panel", {
        isDanger: vault.addresses.length === 0,
    })

    const vaultAction = useSharedPromiseState()

    const [removingVault, removeVault] = usePromiseState(
        async () => {
            await sendMessage({
                id: "removeVault",
                vaultId,
            })
        },
        [],
        vaultAction
    )

    const [settingVaultAsDefault, setVaultAsDefault] = usePromiseState(
        async () => {
            await sendMessage({
                id: "setVaultAsDefault",
                vaultId,
            })
        },
        [],
        vaultAction
    )

    const vaultActionError = vaultAction.lastError ? (
        <Status level="danger" colorText={true}>
            {vaultAction.lastError.toString()}
        </Status>
    ) : null
    const titleSuffix = isDefault ? " [Default]" : ""

    return (
        <article className={panelClass}>
            <p className="panel-heading">{vault.name + titleSuffix}</p>
            <StorageAddresses
                vaultId={vaultId}
                addresses={vault.addresses}
                syncState={vault.syncState}
            />
            <div className="panel-block is-flex-direction-column is-align-items-start gap-1">
                <StorageButtons vaultId={vaultId} />
                {vaultActionError}
                <div className="is-flex is-flex-wrap-wrap gap-1">
                    <IconButton
                        className={cn({
                            isLoading: settingVaultAsDefault.inProgress,
                        })}
                        iconClass="fas fa-xmark"
                        disabled={isDefault || vaultAction.inProgress}
                        onClick={setVaultAsDefault}
                    >
                        Set As Default
                    </IconButton>
                    <IconButton
                        className={cn({
                            isDanger: true,
                            isLoading: removingVault.inProgress,
                        })}
                        iconClass="fas fa-xmark"
                        disabled={vaultAction.inProgress}
                        onClick={removeVault}
                    >
                        Delete Vault
                    </IconButton>
                </div>
            </div>
        </article>
    )
}
