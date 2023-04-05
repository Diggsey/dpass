import { VaultItemPayload } from "../state"

export type EditVaultNameMessage = {
    id: "editVaultName"
    vaultId: string
    name: string
}
export type CreateVaultItemMessage = {
    id: "createVaultItem"
    vaultId: string
    details: ItemDetails
}
export type DeleteVaultItemMessage = {
    id: "deleteVaultItem"
    vaultId: string
    itemId: string
}
export type UpdateVaultItemMessage = {
    id: "updateVaultItem"
    vaultId: string
    itemId: string
    details: ItemDetails
}
export type DecryptVaultItemMessage = {
    id: "decryptVaultItem"
    vaultId: string
    itemId: string
}
export type ItemDetails = {
    origins: string[]
    name: string
    encrypted: boolean
    payload?: VaultItemPayload
}
