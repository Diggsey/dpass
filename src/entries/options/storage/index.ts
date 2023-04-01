import { StorageAddress } from "~/entries/shared/privileged/state"

export type StorageAddressType = StorageAddress["id"]

export type StorageEditorValue<T extends StorageAddress> = {
    address: T
    canSave: boolean
}

export type StorageEditorProps<T extends StorageAddress> = {
    value: StorageEditorValue<T>
    onChange: (newValue: StorageEditorValue<T>) => void
    disabled?: boolean
}

export type StorageEditor<T extends StorageAddress> = React.ComponentType<
    StorageEditorProps<T>
>

export type StorageProvider<id = unknown> = {
    initial: StorageAddress & { id: id }
    initialValid: boolean
    name: string
    icon: string
    description: string
}

export const STORAGE_PROVIDER_MAP: {
    [id in StorageAddressType]: StorageProvider<id>
} = {
    local: {
        initial: {
            id: "local",
            folderName: "default",
        },
        initialValid: true,
        name: "Local Storage",
        icon: "/assets/images/localstorage.svg",
        description:
            "Store data on this device. Cannot be used to sync data between devices.",
    },
    gdrive: {
        initial: {
            id: "gdrive",
            folderId: "",
            userId: "",
        },
        initialValid: false,
        name: "Google Drive",
        icon: "/assets/images/gdrive.png",
        description:
            "Store data in a folder in Google Drive. You will need appropriate access rights to the folder.",
    },
}

const storageProviderOrder = ["local", "gdrive"] as const

export const STORAGE_PROVIDERS = storageProviderOrder.map(
    (x) => STORAGE_PROVIDER_MAP[x]
)
