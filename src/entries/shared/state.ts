import { AutofillMode } from "./autofill"

export type UnprivilegedState = {
    readonly privileged: false
    readonly origin: string
    readonly isUnlocked: boolean
    readonly defaultVaultId: string | null
    readonly vaults: UnprivilegedVaultMap
    readonly syncState: UnprivilegedSyncState
}

export type UnprivilegedVaultMap = {
    readonly [id: string]: UnprivilegedVault
}

export type UnprivilegedSyncState = "idle" | "inProgress" | "warning" | "error"

export type UnprivilegedVault = {
    readonly name: string
    readonly items: VaultItemMap | null
    readonly syncState: UnprivilegedSyncState
    readonly missing: boolean
}

export type VaultItemMap = {
    readonly [id: string]: VaultItem
}

export type VaultItem = {
    readonly origins: string[]
    readonly name: string
    readonly creationTimestamp: number
    readonly updateTimestamp: number
    readonly data: VaultItemData
}

export function computeItemDisplayName(item: VaultItem): string {
    return item.name || item.origins.join(", ") || "Unnamed"
}

export type VaultItemData = PlainVaultItemData | EncryptedVaultItemData

export type PlainVaultItemData = {
    readonly encrypted: false
    readonly payload: VaultItemPayload
}
export type EncryptedVaultItemData = {
    readonly encrypted: true
}

export type VaultItemPayload = {
    readonly login_url?: string
    readonly restrict_url?: true
    readonly fields: VaultItemField[]
}

export type VaultItemField = {
    readonly uuid: string
    readonly name: string
    readonly value: string
    readonly autofillMode: AutofillMode
}

export const UNPRIVILEGED_PORT_NAME = "unprivilegedState"
