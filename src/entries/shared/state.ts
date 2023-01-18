
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
    origin: string | null,
    name?: string,
    creationTimestamp: number,
    updateTimestamp: number,
    data: VaultItemData,
}

export type VaultItemData = UnlockedVaultItemData | LockedVaultItemData

export type UnlockedVaultItemData = {
    locked: false,
    encrypted: boolean,
    payload: VaultItemPayload,
}
export type LockedVaultItemData = {
    locked: true,
    encrypted: true,
}

export type VaultItemPayload = {
    login_url?: string,
    restrict_url?: true,
    fields: VaultItemField[]
}

export type VaultItemField = {
    name: string,
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
