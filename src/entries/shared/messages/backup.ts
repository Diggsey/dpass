export type BackupMessage = {
    id: "backup"
}

export type RestoreMessage = {
    id: "restore"
    url: string
}

export type ExportVaultItemsMessage = {
    id: "exportVaultItems"
    vaultId: string
}

export type ImportVaultItemsMessage = {
    id: "importVaultItems"
    vaultId: string
    url: string
}
