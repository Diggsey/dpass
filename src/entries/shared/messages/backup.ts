export type BackupMessage = {
    id: "backup"
}

export type RestoreMessage = {
    id: "restore"
    url: string
}
