import { FunctionalComponent } from "preact";
import { sendMessage } from "~/entries/shared";
import { IconButton } from "~/entries/shared/components/iconButton";
import { Status } from "~/entries/shared/components/status";
import { PrivilegedState } from "~/entries/shared/privileged/state";
import { cn, usePromiseState } from "~/entries/shared/ui";
import { StorageAddresses } from "../storage/addresses";
import { StorageButtons } from "../storage/buttons";

export const IdentityStoragePanel: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {

    const panelClass = cn("panel", {
        isDanger: !state.hasIdentity || state.rootAddresses.length === 0
    })

    const identityWarning = !state.hasIdentity && <div class="panel-block">
        <Status level="warning">No identity found</Status>
    </div>

    const [creatingIdentity, createIdentity] = usePromiseState(async () => {
        const masterPassword = prompt("Enter master password (8 character minimum):")
        if (masterPassword === null) {
            return
        }
        if (masterPassword.length < 8) {
            throw new Error("Master password must be least 8 characters.")
        }
        await sendMessage({
            id: "createRoot",
            masterPassword,
        })
    }, [])

    const createIdentityError = creatingIdentity.lastError && <Status level="danger" colorText={true}>{creatingIdentity.lastError.toString()}</Status>

    return <article class={panelClass}>
        <p class="panel-heading">
            Storage
        </p>
        <StorageAddresses vaultId={null} addresses={state.rootAddresses} syncState={state.syncState} />
        {identityWarning}
        <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
            <StorageButtons vaultId={null} />
            <IconButton
                class={cn({ isLoading: creatingIdentity.inProgress, isPrimary: true })}
                iconClass="fas fa-user-plus"
                disabled={state.hasIdentity || state.rootAddresses.length === 0}
                onClick={createIdentity}
            >
                New Identity
            </IconButton>
            {createIdentityError}
        </div>
    </article>
}
