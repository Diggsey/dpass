import { FunctionalComponent } from "preact"
import { IconButton } from "~/entries/shared/components/iconButton"
import { PrivilegedVault } from "~/entries/shared/privileged/state"
import { cn } from "~/entries/shared/ui"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const VaultPanel: FunctionalComponent<{ vaultId: string, vault: PrivilegedVault }> = ({ vaultId, vault }) => {
    const panelClass = cn("panel", {
        isDanger: vault.addresses.length === 0
    })
    return <article class={panelClass}>
        <p class="panel-heading">
            {vault.name}
        </p>
        <StorageAddresses vaultId={vaultId} addresses={vault.addresses} syncState={vault.syncState} />
        <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
            <StorageButtons vaultId={vaultId} />
            <IconButton
                class={cn({ isDanger: true })}
                iconClass="fas fa-xmark"
                disabled={false}
            >
                Delete Vault
            </IconButton>
        </div>
    </article>
}
