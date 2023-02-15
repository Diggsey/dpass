import { AutofillMode } from "./autofill"

export type UnprivilegedState = {
    privileged: false,
    origin: string,
    isUnlocked: boolean,
    vaults: UnprivilegedVaultMap,
    syncState: UnprivilegedSyncState,
}

export type UnprivilegedVaultMap = {
    [id: string]: UnprivilegedVault
}

export type UnprivilegedSyncState = "idle" | "inProgress" | "warning" | "error"

export type UnprivilegedVault = {
    name: string,
    items: VaultItemMap | null,
    syncState: UnprivilegedSyncState,
}

export type VaultItemMap = {
    [id: string]: VaultItem
}

export type VaultItem = {
    origins: string[],
    name: string,
    creationTimestamp: number,
    updateTimestamp: number,
    data: VaultItemData,
}

export function computeItemDisplayName(item: VaultItem): string {
    return item.name || item.origins.join(", ") || "Unnamed"
}

export type VaultItemData = PlainVaultItemData | EncryptedVaultItemData

export type PlainVaultItemData = {
    encrypted: false,
    payload: VaultItemPayload,
}
export type EncryptedVaultItemData = {
    encrypted: true,
}

export type VaultItemPayload = {
    login_url?: string,
    restrict_url?: true,
    fields: VaultItemField[]
}

export type VaultItemField = {
    uuid: string,
    name: string,
    value: string,
    autofillMode: AutofillMode
}

export const UNPRIVILEGED_PORT_NAME = "unprivilegedState"
