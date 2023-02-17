
export type CreateRootMessage = {
    id: "createRoot",
    masterPassword: string,
    secretSentence: string,
}
export type EditRootNameMessage = {
    id: "editRootName",
    name: string,
}
export type ChangeRootPasswordMessage = {
    id: "changeRootPassword",
    oldPassword: string,
    newPassword: string,
}
export type CreateVaultMessage = {
    id: "createVault",
    name: string,
}
export type RemoveVaultMessage = {
    id: "removeVault",
    vaultId: string,
}
export type UnlockMessage = {
    id: "unlock",
    masterPassword: string,
    secretSentence: string | null,
}
export type LockMessage = {
    id: "lock",
    unenroll: boolean,
}