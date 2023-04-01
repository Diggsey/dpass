import { StorageAddress } from "../privileged/state"

export type EditStorageAddressesMessage = {
    id: "editStorageAddresses"
    vaultId: string | null
    action: StorageAddressAction
}
export type StorageAddressAction =
    | { id: "add"; storageAddress: StorageAddress }
    | { id: "remove"; storageAddress: StorageAddress }
    | { id: "move"; storageAddress: StorageAddress; priority: number }
    | {
          id: "edit"
          storageAddress: StorageAddress
          newStorageAddress: StorageAddress
      }
