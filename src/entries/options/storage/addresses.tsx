import { FunctionalComponent } from "preact"
import { objectKey, sendMessage } from "~/entries/shared"
import { Status } from "~/entries/shared/components/status"
import { PrivilegedSyncState, StorageAddress } from "~/entries/shared/privileged/state"
import { cn, usePromiseState } from "~/entries/shared/ui"

type StorageAddressRowProps = { index: number, vaultId: string | null, address: StorageAddress, syncStates: PrivilegedSyncState }

export const StorageAddressRow: FunctionalComponent<StorageAddressRowProps> = ({ index, vaultId, address, syncStates }) => {
    const storageKey = objectKey(address)
    const syncState = syncStates[storageKey] ?? { address, inProgress: true }
    let status = null
    if (syncState.inProgress) {
        status = <Status level="loading">Syncing...</Status>
    } else if (syncState.lastError) {
        status = <Status level="danger">{syncState.lastError}</Status>
    } else if (syncState.lastWarning) {
        status = <Status level="warning">{syncState.lastWarning}</Status>
    } else {
        status = <Status level="success">Synced</Status>
    }

    const [movingUp, moveUp] = usePromiseState(async () => {
        if (index > 0) {
            await sendMessage({
                id: "editStorageAddresses",
                vaultId,
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
            id: "editStorageAddresses",
            vaultId,
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

type StorageAddressesProps = { vaultId: string | null, addresses: StorageAddress[], syncState: PrivilegedSyncState }

export const StorageAddresses: FunctionalComponent<StorageAddressesProps> = ({ vaultId, addresses, syncState }) => {
    const storageAddressWarning = addresses.length === 0 && <div class="panel-block">
        <Status level="warning">No storage addresses configured</Status>
    </div>
    return <>
        {addresses.map((address, i) => (
            <StorageAddressRow key={objectKey(address)} index={i} vaultId={vaultId} address={address} syncStates={syncState} />
        ))}
        {storageAddressWarning}
    </>
}
