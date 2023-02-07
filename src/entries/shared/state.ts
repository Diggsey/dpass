
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
    origin: string,
    name: string,
    creationTimestamp: number,
    updateTimestamp: number,
    data: VaultItemData,
}

export function computeItemDisplayName(item: VaultItem): string {
    return item.name || item.origin || "Unnamed"
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
    name: string,
    value: string,
    autofillMode: AutofillMode
}

export type AutofillMode = PresetAutofillMode | CustomAutofillMode

export type PresetAutofillMode = {
    id: "username" | "email" | "password" | "none"
}
export type CustomAutofillMode = {
    id: "custom",
    key: string,
}

export const UNPRIVILEGED_PORT_NAME = "unprivilegedState"
