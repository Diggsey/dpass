export type BackupMessage = {
    readonly id: "backup"
}

export type RestoreMessage = {
    readonly id: "restore"
    readonly url: string
}

export type ExportVaultItemsMessage = {
    readonly id: "exportVaultItems"
    readonly vaultId: string
}

export type ImportVaultItemsMessage = {
    readonly id: "importVaultItems"
    readonly vaultId: string
    readonly url: string
}
