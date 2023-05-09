import { AutofillMode } from "../autofill"
import { GeneratorSettings, VaultItemMap } from "../state"

export type PrivilegedState = {
    readonly privileged: true
    readonly hasIdentity: boolean
    readonly isSetUp: boolean
    readonly isUnlocked: boolean
    readonly isSuper: boolean
    readonly rootInfo: RootInfo | null
    readonly rootAddresses: readonly StorageAddress[]
    readonly defaultVaultId: string | null
    readonly vaults: PrivilegedVaultMap
    readonly syncState: PrivilegedSyncState
    readonly keyPairs: KeyPairMap
    readonly generatorSettings: GeneratorSettings | null
    readonly historyEntries: readonly HistoryEntry[]
}

export type RootInfo = {
    readonly creationTimestamp: number
    readonly updateTimestamp: number
    readonly name: string
    readonly secretSentence: string
}

export type HistoryEntry = {
    readonly uuid: string
    readonly creationTimestamp: number
    readonly type: "generated" | "deleted" | "changed"
    readonly origins: string[]
    readonly name: string
    readonly autofillMode: AutofillMode
    readonly value: string
    readonly entropy?: number
}

export type KeyPairMap = {
    readonly [id: string]: KeyPair
}

export type KeyPair = {
    readonly creationTimestamp: number
    readonly updateTimestamp: number
    readonly name?: string
    readonly publicKey: Uint8Array
}

export type PrivilegedVaultMap = {
    readonly [id: string]: PrivilegedVault
}

export type PrivilegedVault = {
    readonly creationTimestamp: number
    readonly updateTimestamp: number
    readonly name: string
    readonly items: VaultItemMap | null
    readonly addresses: readonly StorageAddress[]
    readonly syncState: PrivilegedSyncState
    readonly missing: boolean
}

export type PrivilegedSyncState = {
    readonly [storageAddress: string]: StorageSyncState
}

export type StorageSyncState = {
    readonly address: StorageAddress
    readonly inProgress: boolean
    readonly lastWarning?: string
    readonly lastError?: string
}

export type LocalStorageAddress = {
    readonly id: "local"
    readonly folderName: string
}
export type GDriveStorageAddress = {
    readonly id: "gdrive"
    readonly folderId: string
    readonly userId: string
}

export type NoConnectionInfo = {
    readonly id: "none"
}

export type OauthConnectionInfo = {
    readonly id: "oauth"
    readonly serverId: "google"
    readonly userId: string
}

export type StorageAddress = LocalStorageAddress | GDriveStorageAddress
export type ConnectionInfo = OauthConnectionInfo | NoConnectionInfo

export type OauthTokenPayload = {
    readonly id: "oauth"
    readonly accessToken: string
}

export type AuthTokenPayload = OauthTokenPayload

export type AuthToken = {
    readonly id: "authToken"
    readonly connectionInfo: ConnectionInfo
    readonly expiresAt: number
    readonly payload: AuthTokenPayload
}

export const PRIVILEGED_PORT_NAME = "privilegedState"
