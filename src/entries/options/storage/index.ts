import { StorageAddress } from "~/entries/shared/privileged/state"

export type StorageAddressType = StorageAddress["id"]

export type StorageProvider = {
    initial: StorageAddress
    name: string
    icon: string
    description: string
}

export const STORAGE_PROVIDER_MAP: {
    [key in StorageAddressType]: StorageProvider
} = {
    local: {
        initial: {
            id: "local",
            folderName: "default",
        },
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
        name: "Google Drive",
        icon: "/assets/images/gdrive.png",
        description:
            "Store data in a folder in Google Drive. You will need appropriate access rights to the folder.",
    },
}

const storageProviderOrder = ["local", "gdrive"] as const

export const STORAGE_PROVIDERS: StorageProvider[] = storageProviderOrder.map(
    (x) => STORAGE_PROVIDER_MAP[x]
)
