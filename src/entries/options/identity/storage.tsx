import { FunctionalComponent } from "preact";
import { objectKey } from "~/entries/background/storage/connection";
import { sendMessage } from "~/entries/shared";
import { IconButton } from "~/entries/shared/components/iconButton";
import { Status } from "~/entries/shared/components/status";
import { PrivilegedState, StorageAddress, PrivilegedSyncState } from "~/entries/shared/privileged/state";
import { TOKEN_MANAGER } from "~/entries/shared/tokens";
import { cn, usePromiseState } from "~/entries/shared/ui";

type AddressViewProps = { index: number, address: StorageAddress, syncStates: PrivilegedSyncState }

const AddressView: FunctionalComponent<AddressViewProps> = ({ index, address, syncStates }) => {
    const storageKey = objectKey(address)
    const syncState = syncStates[storageKey] ?? { address, inProgress: true }
    let status = null
    if (syncState.inProgress) {
        status = <Status level="loading" />
    } else if (syncState.lastError) {
        status = <Status level="danger">{syncState.lastError}</Status>
    } else if (syncState.lastWarning) {
        status = <Status level="warning">{syncState.lastWarning}</Status>
    }

    const [movingUp, moveUp] = usePromiseState(async () => {
        if (index > 0) {
            await sendMessage({
                id: "editRootStorageAddresses",
                action: {
                    id: "move",
                    storageAddress: address,
                    priority: index - 1,
                }
            })
        }
    }, [index, address])

    const moveIconClass = cn({
        "fas faArrowUp": index > 0 && !movingUp.inProgress,
        "loader": movingUp.inProgress,
    })

    const [deletingAddress, deleteAddress] = usePromiseState(async () => {
        await sendMessage({
            id: "editRootStorageAddresses",
            action: {
                id: "remove",
                storageAddress: address,
            }
        })
    }, [address])

    const deleteButton = deletingAddress.inProgress
        ? <span class="loader" />
        : <button onClick={deleteAddress} class="delete" />

    return <div class="panel-block is-flex">
        <a class="is-flex-grow-0" onClick={moveUp}>
            <span class="icon is-medium">
                <i class={moveIconClass} />
            </span>
        </a>
        <div class="is-flex-grow-1">
            <p>{storageKey}</p>
        </div>
        <div class="is-flex-grow-1">
            {status}
        </div>
        <div class="is-flex-grow-0">
            {deleteButton}
        </div>
    </div>
}

export const StoragePanel: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {

    const panelClass = cn("panel", {
        isDanger: !state.hasIdentity || state.rootAddresses.length === 0
    })

    const panelBody = state.rootAddresses.map((address, i) => (
        <AddressView key={objectKey(address)} index={i} address={address} syncStates={state.syncState} />
    ))
    const storageAddressWarning = state.rootAddresses.length === 0 && <div class="panel-block">
        <Status level="warning">No storage addresses configured</Status>
    </div>
    const identityWarning = !state.hasIdentity && <div class="panel-block">
        <Status level="warning">No identity found</Status>
    </div>

    const [addingStorage, addStorage] = usePromiseState(async (storageAddress: StorageAddress) => {
        await sendMessage({
            id: "editRootStorageAddresses",
            action: {
                id: "add",
                storageAddress,
            }
        })
    }, [])

    const addStorageError = addingStorage.lastError && <Status level="danger" colorText={true}>{addingStorage.lastError.toString()}</Status>

    const addStorageButtonClass = (id: StorageAddress["id"]) => cn({
        isLoading: addingStorage.inProgress && addingStorage.lastArgs[0].id === id,
        isLink: true,
    })

    const disabledValue = (id: StorageAddress["id"]) => (
        addingStorage.inProgress && addingStorage.lastArgs[0].id !== id
    )

    const addLocalStorage = async () => {
        const folderName = prompt("Enter folder name:", "default")
        if (!folderName) {
            return
        }
        await addStorage({
            id: "local",
            folderName,
        })
    }

    const addGDriveStorage = async () => {
        const folderUrl = prompt("Enter sharing URL for the GDrive folder to use:")
        if (!folderUrl) {
            return
        }
        const folderLocation = new URL(folderUrl).pathname
        const folderId = folderLocation.split("/").pop()
        if (!folderId) {
            throw new Error("Invalid sharing URL")
        }
        const [_token, connectionInfo] = await TOKEN_MANAGER.request({
            id: "oauth",
            serverId: "google",
            userId: ""
        })
        if (connectionInfo.id !== "oauth") {
            throw new Error("Expected connection type to be Oauth")
        }
        await addStorage({
            id: "gdrive",
            folderId,
            userId: connectionInfo.userId,
        })
    }

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
        {panelBody}
        {storageAddressWarning}
        {identityWarning}
        <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
            <div class="is-flex is-flex-wrap-wrap gap-1">
                <IconButton
                    class={addStorageButtonClass("local")}
                    iconClass="fas fa-location-dot"
                    disabled={disabledValue("local")}
                    onClick={addLocalStorage}
                >
                    Add Local Storage
                </IconButton>
                <IconButton
                    class={addStorageButtonClass("gdrive")}
                    iconClass="fab fa-google-drive"
                    disabled={disabledValue("gdrive")}
                    onClick={addGDriveStorage}
                >
                    Add GDrive Storage
                </IconButton>
            </div>
            {addStorageError}
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
