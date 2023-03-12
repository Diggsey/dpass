import { FunctionalComponent } from "preact"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { cn, usePromiseState } from "~/entries/shared/ui"
import { VaultPanel } from "./vault"

export const VaultsPage: FunctionalComponent<{ state: PrivilegedState }> = ({
    state,
}) => {
    const allVaults = Object.entries(state.vaults)
    allVaults.sort((a, b) => a[1].name.localeCompare(b[1].name))
    const vaultPanels = allVaults.map(([vaultId, vault]) => (
        <VaultPanel
            key={vaultId}
            vaultId={vaultId}
            vault={vault}
            isDefault={vaultId === state.defaultVaultId}
        />
    ))

    const [creatingVault, createVault] = usePromiseState(async () => {
        const name = prompt("Enter vault name:", "Personal Vault")
        if (!name) {
            return
        }
        await sendMessage({
            id: "createVault",
            name,
        })
    }, [])

    const createVaultError = creatingVault.lastError && (
        <Status level="danger" colorText={true}>
            {creatingVault.lastError.toString()}
        </Status>
    )

    return (
        <>
            <article class="panel is-info">
                <p class="panel-heading">Vault Management</p>
                <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
                    {createVaultError}
                    <IconButton
                        class={cn({
                            isLoading: creatingVault.inProgress,
                            isPrimary: true,
                        })}
                        iconClass="fas fa-vault"
                        disabled={creatingVault.inProgress}
                        onClick={createVault}
                    >
                        Create new vault
                    </IconButton>
                </div>
            </article>
            {vaultPanels}
        </>
    )
}
