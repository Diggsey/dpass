import { useState } from "react"
import { Loader } from "~/entries/shared/components/loader"
import { sendMessage } from "~/entries/shared/messages"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { SharedPromiseState, usePromiseState } from "~/entries/shared/ui/hooks"
import { StorageEditorProps, STORAGE_PROVIDER_MAP } from "."
import { GDriveStorageEditor } from "./gDriveStorageEditor"
import { LocalStorageEditor } from "./localStorageEditor"
import { StorageTypePicker } from "./storageTypePicker"

type StorageAddressEditorProps = {
    isNew: boolean
    address: StorageAddress
    vaultId: string | null
    onClose: () => void
    parentState: SharedPromiseState
}

const GenericStorageEditor = ({
    value: { address, canSave },
    ...other
}: StorageEditorProps<StorageAddress>) => {
    switch (address.id) {
        case "local":
            return (
                <LocalStorageEditor value={{ address, canSave }} {...other} />
            )
        case "gdrive":
            return (
                <GDriveStorageEditor value={{ address, canSave }} {...other} />
            )
    }
}

export const StorageAddressEditor = ({
    isNew,
    address,
    vaultId,
    onClose,
    parentState,
}: StorageAddressEditorProps) => {
    const [edited, setEdited] = useState({
        address,
        canSave: isNew,
    })

    const currentProvider = STORAGE_PROVIDER_MAP[edited.address.id]

    const [savingAddress, saveAddress] = usePromiseState(
        async () => {
            if (isNew) {
                await sendMessage({
                    id: "editStorageAddresses",
                    vaultId,
                    action: {
                        id: "add",
                        storageAddress: edited.address,
                    },
                })
            } else {
                await sendMessage({
                    id: "editStorageAddresses",
                    vaultId,
                    action: {
                        id: "edit",
                        storageAddress: address,
                        newStorageAddress: edited.address,
                    },
                })
            }
            onClose()
        },
        [isNew, address, edited.address, onClose],
        parentState
    )

    return (
        <div className="px-4 py-4 sm:px-6 gap-8 grid">
            <StorageTypePicker
                value={edited.address.id}
                onChange={(v) => {
                    const newProvider = STORAGE_PROVIDER_MAP[v]
                    setEdited({
                        address: newProvider.initial,
                        canSave: newProvider.initialValid,
                    })
                }}
                disabled={parentState.inProgress}
            />
            <div className="gap-4 grid">
                <div className="text-base font-semibold leading-6 text-gray-900">
                    Configure{" "}
                    <span className="text-indigo-600 cursor-default">
                        {currentProvider.name}
                    </span>
                </div>
                <GenericStorageEditor
                    value={edited}
                    onChange={setEdited}
                    disabled={parentState.inProgress}
                />
            </div>
            <div className="flex items-center justify-end gap-x-6">
                <button
                    type="button"
                    className="text-sm font-semibold leading-6 text-gray-900"
                    onClick={onClose}
                    disabled={parentState.inProgress}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="rounded-md bg-indigo-600 disabled:bg-indigo-300 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    onClick={saveAddress}
                    disabled={parentState.inProgress || !edited.canSave}
                >
                    {savingAddress.inProgress && (
                        <Loader className="-ml-0.5 mr-1.5 h-5 w-5" />
                    )}
                    <span>Save</span>
                </button>
            </div>
        </div>
    )
}
