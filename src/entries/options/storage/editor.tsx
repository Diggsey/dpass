import { FormEvent, useState } from "react"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { Loader } from "~/entries/shared/components/icons/loader"
import {
    Card,
    PrimaryButton,
    SecondaryButton,
} from "~/entries/shared/components/styledElem"
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
        async (e: FormEvent) => {
            e.preventDefault()
            if (!edited.canSave) {
                return
            }
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
        <form onSubmit={saveAddress}>
            <Card.Body className="gap-8 grid">
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
                <div className="flex items-center justify-end gap-3">
                    <SecondaryButton
                        type="button"
                        onClick={onClose}
                        disabled={parentState.inProgress}
                    >
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton
                        type="submit"
                        disabled={parentState.inProgress || !edited.canSave}
                    >
                        {savingAddress.inProgress && (
                            <ButtonIcon icon={Loader} />
                        )}
                        <span>Save</span>
                    </PrimaryButton>
                </div>
            </Card.Body>
        </form>
    )
}
