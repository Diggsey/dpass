import { VaultItemMap } from "../state"

export type PrivilegedState = {
    privileged: true,
    hasRoot: boolean,
    rootAddresses: StorageAddress[],
    vaults: PrivilegedVaultMap,
    syncState: PrivilegedSyncState,
    keyPairs: KeyPairMap,
}

export type KeyPairMap = {
    [id: string]: KeyPair
}

export type KeyPair = {
    creationTimestamp: number,
    updateTimestamp: number,
    name?: string,
    publicKey: Uint8Array,
    privateKey: Uint8Array | null,
}

export type PrivilegedVaultMap = {
    [id: string]: PrivilegedVault
}

export type PrivilegedVault = {
    name: string,
    items: VaultItemMap | null,
    syncState: PrivilegedSyncState,
}

export type PrivilegedSyncState = {
    [storageAddress: string]: StorageSyncState
}

export type StorageSyncState = {
    address: StorageAddress,
    inProgress: boolean,
    lastWarning?: string,
    lastError?: string,
}

export type LocalStorageAddress = {
    id: "local",
    folderName: string,
}
export type GDriveStorageAddress = {
    id: "gdrive",
    folderId: string,
    userId: string,
}

export type NoConnectionInfo = {
    id: "none"
}

export type OauthConnectionInfo = {
    id: "oauth"
    serverId: "google",
    userId: string,
}

export type StorageAddress = LocalStorageAddress | GDriveStorageAddress
export type ConnectionInfo = OauthConnectionInfo | NoConnectionInfo

export const PRIVILEGED_PORT_NAME = "privilegedState"
