import { FunctionalComponent } from "preact"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { PrivilegedVault } from "~/entries/shared/privileged/state"
import { cn, usePromiseState } from "~/entries/shared/ui"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const VaultPanel: FunctionalComponent<{
    vaultId: string
    vault: PrivilegedVault
}> = ({ vaultId, vault }) => {
    const panelClass = cn("panel", {
        isDanger: vault.addresses.length === 0,
    })

    const [removingVault, removeVault] = usePromiseState(async () => {
        await sendMessage({
            id: "removeVault",
            vaultId,
        })
    }, [])

    const removeVaultError = removingVault.lastError && (
        <Status level="danger" colorText={true}>
            {removingVault.lastError.toString()}
        </Status>
    )

    return (
        <article class={panelClass}>
            <p class="panel-heading">{vault.name}</p>
            <StorageAddresses
                vaultId={vaultId}
                addresses={vault.addresses}
                syncState={vault.syncState}
            />
            <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
                <StorageButtons vaultId={vaultId} />
                {removeVaultError}
                <IconButton
                    class={cn({
                        isDanger: true,
                        isLoading: removingVault.inProgress,
                    })}
                    iconClass="fas fa-xmark"
                    disabled={removingVault.inProgress}
                    onClick={removeVault}
                >
                    Delete Vault
                </IconButton>
            </div>
        </article>
    )
}
