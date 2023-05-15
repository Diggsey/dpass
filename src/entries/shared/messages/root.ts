export type CreateRootMessage = {
    readonly id: "createRoot"
    readonly name: string
    readonly masterPassword: string
    readonly secretSentence: string
}
export type EditRootNameMessage = {
    readonly id: "editRootName"
    readonly name: string
}
export type ChangeRootPasswordMessage = {
    readonly id: "changeRootPassword"
    readonly oldPassword: string
    readonly newPassword?: string
    readonly newSentence?: string
}
export type CreateVaultMessage = {
    readonly id: "createVault"
    readonly name: string
    readonly copyStorage: boolean
}
export type RemoveVaultMessage = {
    readonly id: "removeVault"
    readonly vaultId: string
}
export type UnlockMessage = {
    readonly id: "unlock"
    readonly masterPassword: string
    readonly secretSentence: string | null
}
export type LockMessage = {
    readonly id: "lock"
    readonly unenroll: boolean
}
export type SetVaultAsDefaultMessage = {
    readonly id: "setVaultAsDefault"
    readonly vaultId: string
}
export type ClearHistoryMessage = {
    readonly id: "clearHistory"
}
