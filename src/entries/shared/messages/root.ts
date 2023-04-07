export type CreateRootMessage = {
    id: "createRoot"
    name: string
    masterPassword: string
    secretSentence: string
}
export type EditRootNameMessage = {
    id: "editRootName"
    name: string
}
export type ChangeRootPasswordMessage = {
    id: "changeRootPassword"
    oldPassword: string
    newPassword?: string
    newSentence?: string
}
export type CreateVaultMessage = {
    id: "createVault"
    name: string
    copyStorage: boolean
}
export type RemoveVaultMessage = {
    id: "removeVault"
    vaultId: string
}
export type UnlockMessage = {
    id: "unlock"
    masterPassword: string
    secretSentence: string | null
}
export type LockMessage = {
    id: "lock"
    unenroll: boolean
}
export type SetVaultAsDefault = {
    id: "setVaultAsDefault"
    vaultId: string
}
