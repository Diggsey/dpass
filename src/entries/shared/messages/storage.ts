import { StorageAddress } from "../privileged/state"

export type EditStorageAddressesMessage = {
    readonly id: "editStorageAddresses"
    readonly vaultId: string | null
    readonly action: StorageAddressAction
}
export type StorageAddressAction =
    | { readonly id: "add"; readonly storageAddress: StorageAddress }
    | {
          readonly id: "remove"
          readonly storageAddress: StorageAddress
          readonly wipe: boolean
      }
    | {
          readonly id: "move"
          readonly storageAddress: StorageAddress
          readonly priority: number
      }
    | {
          readonly id: "edit"
          readonly storageAddress: StorageAddress
          readonly newStorageAddress: StorageAddress
      }
