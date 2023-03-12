import { FunctionalComponent } from "preact"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { PrivilegedVault } from "~/entries/shared/privileged/state"
import { cn, usePromiseState, useSharedPromiseState } from "~/entries/shared/ui"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const VaultPanel: FunctionalComponent<{
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

    const vaultActionError = vaultAction.lastError && (
        <Status level="danger" colorText={true}>
            {vaultAction.lastError.toString()}
        </Status>
    )
    const titleSuffix = isDefault ? " [Default]" : ""

    return (
        <article class={panelClass}>
            <p class="panel-heading">{vault.name + titleSuffix}</p>
            <StorageAddresses
                vaultId={vaultId}
                addresses={vault.addresses}
                syncState={vault.syncState}
            />
            <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
                <StorageButtons vaultId={vaultId} />
                {vaultActionError}
                <div class="is-flex is-flex-wrap-wrap gap-1">
                    <IconButton
                        class={cn({
                            isLoading: settingVaultAsDefault.inProgress,
                        })}
                        iconClass="fas fa-xmark"
                        disabled={isDefault || vaultAction.inProgress}
                        onClick={setVaultAsDefault}
                    >
                        Set As Default
                    </IconButton>
                    <IconButton
                        class={cn({
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
