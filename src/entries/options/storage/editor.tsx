import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { useState } from "react"
import { sendMessage } from "~/entries/shared/messages"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { usePromiseState } from "~/entries/shared/ui/hooks"
import { STORAGE_PROVIDER_MAP } from "."
import { StorageTypePicker } from "./storageTypePicker"

type StorageAddressEditorProps = {
    isNew: boolean
    address: StorageAddress
    vaultId: string | null
    onClose: () => void
}

export const StorageAddressEditor = ({
    address,
    vaultId,
    onClose,
}: StorageAddressEditorProps) => {
    const [editedAddress, setEditedAddress] = useState(address)
    const [deletingAddress, deleteAddress] = usePromiseState(async () => {
        await sendMessage({
            id: "editStorageAddresses",
            vaultId,
            action: {
                id: "remove",
                storageAddress: address,
            },
        })
    }, [address])

    const deleteButton = deletingAddress.inProgress ? (
        <span className="loader" />
    ) : (
        <button onClick={deleteAddress} className="delete" />
    )

    return (
        <div className="px-4 py-4 sm:px-6">
            <button
                onClick={onClose}
                className="flex items-center text-sm text-gray-500 my-4"
            >
                <ChevronLeftIcon
                    className="h-4 w-4 mr-1 text-gray-400"
                    aria-hidden="true"
                />
                <span>Cancel</span>
            </button>
            <StorageTypePicker
                value={editedAddress.id}
                onChange={(v) =>
                    setEditedAddress(STORAGE_PROVIDER_MAP[v].initial)
                }
            />
            <div>Editing...</div>
            <div>
                <button onClick={onClose}>Save</button>
            </div>
        </div>
    )
}
