import { VaultItemPayload } from "../state"

export type EditVaultNameMessage = {
    readonly id: "editVaultName"
    readonly vaultId: string
    readonly name: string
}
export type CreateVaultItemMessage = {
    readonly id: "createVaultItem"
    readonly vaultId?: string
    readonly details: ItemDetails
}
export type DeleteVaultItemMessage = {
    readonly id: "deleteVaultItem"
    readonly vaultId: string
    readonly itemId: string
}
export type UpdateVaultItemMessage = {
    readonly id: "updateVaultItem"
    readonly vaultId: string
    readonly itemId: string
    readonly details: ItemDetails
}
export type DecryptVaultItemMessage = {
    readonly id: "decryptVaultItem"
    readonly vaultId: string
    readonly itemId: string
}
export type ItemDetails = {
    readonly origins: string[]
    readonly name: string
    readonly encrypted: boolean
    readonly payload?: VaultItemPayload
}
