import { Actor } from "./actor";
import { decodeRootData, DecryptedRootFile, encodeRootData, KeyPair, RootInfo, Vault } from "./serialize/rootData";
import { decodeVaultData, DecryptedVaultFile, encodeVaultData, NormalItem, VaultFileItem, VaultInfoItem, VaultItemData } from "./serialize/vaultData";
import { STORAGE_MANAGER } from "./storage/connection";
import { IIntegrator, SyncManager } from "./sync/manager";
import browser from "webextension-polyfill";
import { PrivilegedState, PrivilegedSyncState, PrivilegedVault, StorageAddress } from "../shared/privileged/state";
import { IStatePublisher } from "./pubsub/state";
import { decodeRoot, encodeRoot } from "./serialize/root";
import { areFilesEqual, extractItems, itemCreator, itemPatcher, MergeableItem, mergeFiles, newFile } from "./serialize/merge";
import { combineKeys, decrypt, decryptKey, deriveKeyFromSuperKey, deriveSuperKeyFromPassword as deriveKeyFromPassword, encrypt, encryptKey, exportKey, generateSalt, generateSuperKey, importKey, KeyApplication } from "./crypto";
import { ItemDetails, objectKey } from "../shared";
import { requestUnlock } from "./unlock";
import { decodeVault, encodeVault } from "./serialize/vault";
import * as msgpack from "@msgpack/msgpack"
import { deleteKey, loadKey, PersistentKeyType, storeKey } from "./persistentKeys";


type VaultState = {
    keySalt: Uint8Array | null,
    vault: DecryptedVaultFile | null,
    syncManagers: Map<string, SyncManager>,
}
type NewVaultHint = {
    keySalt: Uint8Array,
    vault: DecryptedVaultFile,
}

type UpdateRootHint = {
    newVaults?: { [vaultId: string]: NewVaultHint }
}

type TimerId = ReturnType<typeof setTimeout>

const ROOT_FILE_ID = "root"
const SUPER_KEY_TIMEOUT = 30000

type PendingRootIntegration = {
    file: Uint8Array,
    resolve: () => void,
    reject: (err: unknown) => void,
}

type LockedSyncedRoot = {
    priority: number,
    passwordSalt: Uint8Array,
    sentenceSalt: Uint8Array,
    keySalt: Uint8Array,
    pendingRootIntegrations: Map<number, PendingRootIntegration>,
    canaryData: Uint8Array,
}

class IncorrectPasswordError extends Error {
    constructor() {
        super("Incorrect password")
    }
}

class SecureContext extends Actor implements IIntegrator {
    #setupKey: CryptoKey | null = null
    #superKey: CryptoKey | null = null
    #superKeyTimer: TimerId | null = null
    #key: CryptoKey | null = null
    #root: DecryptedRootFile | null = null
    #syncManagers: Map<string, SyncManager> = new Map()
    #vaults: Map<string, VaultState> = new Map()
    #rootAddresses: StorageAddress[] = []
    #privilegedState: PrivilegedState = {
        privileged: true,
        hasIdentity: false,
        isSetUp: false,
        isUnlocked: false,
        isSuper: false,
        rootInfo: null,
        rootAddresses: [],
        vaults: {},
        syncState: {},
        keyPairs: {},
    }
    #statePublishers: Set<IStatePublisher> = new Set()
    #statePublishTimer: TimerId | null = null
    #lockedSyncedRoot: LockedSyncedRoot | null = null

    #loadRootAddresses = async () => {
        const res = await browser.storage.sync.get("rootAddresses")
        if (res.rootAddresses) {
            await this.#updateRootAddresses(res.rootAddresses)
        }
    }

    #updateSetupKey(setupKey: CryptoKey | null, alreadyStored?: boolean) {
        if (setupKey && !alreadyStored) {
            void storeKey(PersistentKeyType.setupKey, setupKey)
        } else if (setupKey === null) {
            void deleteKey(PersistentKeyType.setupKey)
        }
        this.#setupKey = setupKey
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isSetUp: setupKey !== null,
        })
    }

    #loadSetupKey = async () => {
        const setupKey = await loadKey(PersistentKeyType.setupKey)
        if (setupKey) {
            this.#updateSetupKey(setupKey, true)
        }
    }

    #updatePrivilegedState(privilegedState: PrivilegedState) {
        this.#privilegedState = privilegedState
        if (this.#statePublishTimer === null) {
            this.#statePublishTimer = setTimeout(() => {
                this.#statePublishTimer = null
                for (const statePublisher of this.#statePublishers) {
                    statePublisher.publishPrivileged(this.#privilegedState)
                }
            }, 0)
        }
    }

    #syncStateChanged(fileId: string) {
        const map = this.#getSyncManagers(fileId)
        if (!map) {
            return
        }
        const syncState: PrivilegedSyncState = {}
        for (const [k, v] of map) {
            syncState[k] = {
                address: v.storage.address,
                inProgress: v.busy,
                lastError: v.lastError?.toString(),
            }
        }
        if (fileId === ROOT_FILE_ID) {
            this.#updatePrivilegedState({
                ...this.#privilegedState,
                syncState
            })
        } else {
            const vault = this.#privilegedState.vaults[fileId]
            if (vault) {
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    vaults: {
                        ...this.#privilegedState.vaults,
                        [fileId]: {
                            ...vault,
                            syncState,
                        },
                    }
                })
            }
        }
    }

    #updateSyncManagersFromAddresses(fileId: string, addresses: StorageAddress[], oldMap: Map<string, SyncManager>): Map<string, SyncManager> {
        const newMap = new Map<string, SyncManager>()
        for (const [i, address] of addresses.entries()) {
            const addressKey = objectKey(address)
            const syncManager = oldMap.get(addressKey)
            if (syncManager && syncManager.priority === i) {
                oldMap.delete(addressKey)
                newMap.set(addressKey, syncManager)
            } else {
                void this._post(`setupSyncManager(${fileId}, ${addressKey}, ${i})`, () => this.#setupSyncManager(fileId, address, i))
            }
        }
        for (const syncManager of oldMap.values()) {
            syncManager.dispose()
        }
        if (oldMap.size > 0) {
            void this._post(`syncStateChanged(${fileId})`, async () => this.#syncStateChanged(fileId))
        }
        return newMap
    }

    #getSyncManagers(fileId: string): Map<string, SyncManager> | null {
        if (fileId == ROOT_FILE_ID) {
            return this.#syncManagers
        } else {
            const vaultState = this.#vaults.get(fileId)
            if (!vaultState) { return null }
            return vaultState.syncManagers
        }
    }

    async #setupSyncManager(fileId: string, address: StorageAddress, priority: number) {
        const map = this.#getSyncManagers(fileId)
        if (!map) {
            return
        }
        const addressKey = objectKey(address)
        if (map.get(addressKey)) {
            return
        }
        const storage = await STORAGE_MANAGER.open(address)
        const syncManager = new SyncManager(storage, fileId, this, priority)
        syncManager.addEventListener("busychanged", () => {
            void this._post(`syncStateChanged(${fileId})`, async () => {
                this.#syncStateChanged(fileId)
            })
        })
        map.set(addressKey, syncManager)
        this.#syncStateChanged(fileId)

        if (fileId === ROOT_FILE_ID) {
            await this.#saveRootChanges(addressKey)
        } else {
            await this.#saveVaultChanges(fileId, addressKey)
        }
    }

    async #updateRootAddresses(rootAddresses: StorageAddress[]) {
        this.#rootAddresses = rootAddresses
        this.#syncManagers = this.#updateSyncManagersFromAddresses(ROOT_FILE_ID, this.#rootAddresses, this.#syncManagers)
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            rootAddresses: this.#rootAddresses,
        })
    }

    async #saveRootChanges(addressKey?: string) {
        if (this.#key && this.#root && this.#lockedSyncedRoot) {
            // Upload root changes
            const encodedData = encodeRootData(this.#root)
            const encryptedData = await encrypt(this.#key, encodedData)
            const file = encodeRoot({
                passwordSalt: this.#lockedSyncedRoot.passwordSalt,
                sentenceSalt: this.#lockedSyncedRoot.sentenceSalt,
                keySalt: this.#lockedSyncedRoot.keySalt,
                encryptedData: new Uint8Array(encryptedData),
            })
            if (addressKey) {
                const syncManager = this.#syncManagers.get(addressKey)
                if (syncManager) {
                    syncManager.onDataChanged(file)
                }
            } else {
                for (const syncManager of this.#syncManagers.values()) {
                    syncManager.onDataChanged(file)
                }
            }
        }
    }

    async #updateRoot(newRoot: DecryptedRootFile | null, hint?: UpdateRootHint) {
        // Do nothing if there are no changes
        if (areFilesEqual(this.#root, newRoot)) {
            return
        }
        this.#root = newRoot
        const newVaults = new Map<string, VaultState>()
        if (this.#root) {
            // Connect to new vault addresses
            for (const item of this.#root.items) {
                if (item.payload?.id === "vault") {
                    const { fileId, addresses } = item.payload
                    let vaultState = this.#vaults.get(fileId)
                    this.#vaults.delete(fileId)
                    if (!vaultState) {
                        const vaultHint = hint?.newVaults && hint.newVaults[fileId] || {
                            keySalt: null,
                            vault: null,
                        }
                        vaultState = { ...vaultHint, syncManagers: new Map() }
                    }
                    vaultState = {
                        ...vaultState,
                        syncManagers: this.#updateSyncManagersFromAddresses(fileId, addresses, vaultState.syncManagers)
                    }
                    newVaults.set(fileId, vaultState)
                }
            }
        }
        // Disconnect from old vault addresses
        for (const oldVaultState of this.#vaults.values()) {
            for (const syncManager of oldVaultState.syncManagers.values()) {
                syncManager.dispose()
            }
        }
        this.#vaults = newVaults
        await this.#saveRootChanges()

        // Extract "root info" item
        const rootInfo = this.#root &&
            extractItems(this.#root, (item): item is MergeableItem<RootInfo> => item.payload.id === "rootInfo")[0]

        // Extract "vault" items
        const vaults = this.#root ?
            Object.fromEntries(extractItems(this.#root, (item): item is MergeableItem<Vault> => item.payload.id === "vault").map(vault => {
                const vaultState = this.#vaults.get(vault.payload.fileId)
                if (!vaultState) {
                    throw new Error("Vault state should have been initialized")
                }
                const prevVault = this.#privilegedState.vaults[vault.payload.fileId] || this.#computePrivilegedVaultState(vaultState.vault)
                return [vault.payload.fileId, {
                    ...prevVault,
                    addresses: vault.payload.addresses,
                    syncState: prevVault?.syncState || {}
                }]
            })) : {}

        // Extract "key-pair" items
        const keyPairs = this.#root ?
            Object.fromEntries(extractItems(this.#root, (item): item is MergeableItem<KeyPair> => item.payload.id === "keyPair").map(keyPair => {
                return [keyPair.uuid, {
                    name: keyPair.payload.name,
                    creationTimestamp: keyPair.creationTimestamp,
                    updateTimestamp: keyPair.updateTimestamp,
                    publicKey: keyPair.payload.publicKey,
                }]
            })) : {}

        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isUnlocked: this.#root !== null,
            rootInfo: rootInfo && {
                ...rootInfo.payload,
                creationTimestamp: rootInfo.creationTimestamp,
                updateTimestamp: rootInfo.updateTimestamp,
            },
            vaults,
            keyPairs,
        })
    }

    async #integrateRoot(file: Uint8Array, priority: number) {
        const { version, passwordSalt, sentenceSalt, keySalt, encryptedData } = decodeRoot(file)
        if (this.#key === null) {
            if (!this.#lockedSyncedRoot || priority <= this.#lockedSyncedRoot.priority) {
                this._lockedSyncedRoot = {
                    priority,
                    passwordSalt,
                    sentenceSalt,
                    keySalt,
                    pendingRootIntegrations: this.#lockedSyncedRoot?.pendingRootIntegrations || new Map(),
                    canaryData: encryptedData,
                }
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    hasIdentity: true,
                })
            }
            const pendingRootIntegrations = this._lockedSyncedRoot.pendingRootIntegrations
            await new Promise<void>((resolve, reject) => {
                pendingRootIntegrations.set(priority, { file, resolve, reject })
            })
        } else {
            const buffer = await decrypt(this.#key, encryptedData)
            const downloadedRoot = decodeRootData(new Uint8Array(buffer), version)
            await this._post("mergeAndUpdateRoot(...)", async () => {
                const mergedRoot = this.#root ? mergeFiles(this.#root, downloadedRoot) : downloadedRoot
                await this.#updateRoot(mergedRoot)
            })

        }
    }

    async #saveVaultChanges(vaultId: string, addressKey?: string) {
        const vaultDesc = this.#getVaultDesc(vaultId)
        const vaultState = this.#vaults.get(vaultId)
        if (!vaultDesc || !vaultState?.vault || !vaultState.keySalt) {
            return
        }
        // Upload vault changes
        const encodedData = encodeVaultData(vaultState.vault)
        const vaultKey = await importKey(vaultDesc.payload.vaultKey)
        const encryptedData = await encrypt(vaultKey, encodedData)
        const file = encodeVault({
            keySalt: vaultState.keySalt,
            encryptedData: new Uint8Array(encryptedData),
        })
        if (addressKey) {
            const syncManager = vaultState.syncManagers.get(addressKey)
            if (syncManager) {
                syncManager.onDataChanged(file)
            }
        } else {
            for (const syncManager of vaultState.syncManagers.values()) {
                syncManager.onDataChanged(file)
            }
        }
    }

    #computePrivilegedVaultState(vault: DecryptedVaultFile | null): PrivilegedVault {
        if (!vault) {
            return {
                name: "<Unknown>",
                items: {},
                addresses: [],
                syncState: {},
            }
        }

        // Extract "vault info" item
        const vaultInfo = extractItems(vault, (item): item is MergeableItem<VaultInfoItem> => item.payload.id === "vaultInfo")[0]
        if (!vaultInfo) {
            throw new Error("Missing vault info")
        }

        // Extract normal items
        const normalItems = extractItems(vault, (item): item is MergeableItem<NormalItem> => item.payload.id === "normal")

        return {
            name: vaultInfo.payload.name,
            items: Object.fromEntries(normalItems.map(normalItem => [normalItem.uuid, {
                creationTimestamp: normalItem.creationTimestamp,
                updateTimestamp: normalItem.updateTimestamp,
                name: normalItem.payload.name,
                origin: normalItem.payload.origin,
                data: normalItem.payload.data.encrypted
                    ? { encrypted: true }
                    : { encrypted: false, payload: normalItem.payload.data.payload }
            }])),
            addresses: [],
            syncState: {},
        }
    }

    async #updateVault(vaultId: string, newVault: DecryptedVaultFile, keySalt?: Uint8Array) {
        const prevVaultState = this.#vaults.get(vaultId)
        if (!prevVaultState) {
            return
        }
        if (areFilesEqual(prevVaultState.vault, newVault) && (!keySalt || keySalt === prevVaultState.keySalt)) {
            return
        }
        this.#vaults.set(vaultId, {
            syncManagers: prevVaultState.syncManagers,
            keySalt: keySalt || prevVaultState.keySalt,
            vault: newVault,
        })

        await this.#saveVaultChanges(vaultId)

        const prevVault = this.#privilegedState.vaults[vaultId]
        if (!prevVault) {
            return
        }

        this.#updatePrivilegedState({
            ...this.#privilegedState,
            vaults: {
                ...this.#privilegedState.vaults,
                [vaultId]: {
                    ...this.#computePrivilegedVaultState(newVault),
                    addresses: prevVault.addresses,
                    syncState: prevVault.syncState,
                },
            },
        })
    }

    #getVaultDesc(vaultId: string): MergeableItem<Vault> | undefined {
        if (!this.#root) {
            return
        }
        return extractItems(this.#root, (item): item is MergeableItem<Vault> => item.payload.id === "vault" && item.payload.fileId === vaultId)[0]
    }

    async #integrateVault(fileId: string, file: Uint8Array) {
        const vaultDesc = this.#getVaultDesc(fileId)
        if (!vaultDesc) {
            return
        }
        const { version, keySalt, encryptedData } = decodeVault(file)
        const vaultKey = await importKey(vaultDesc.payload.vaultKey)
        const buffer = await decrypt(vaultKey, encryptedData)
        const downloadedVault = decodeVaultData(new Uint8Array(buffer), version)
        await this._post(`mergeAndUpdateVault(${fileId})`, async () => {
            const vaultState = this.#vaults.get(fileId)
            const mergedVault = vaultState?.vault ? mergeFiles(vaultState.vault, downloadedVault) : downloadedVault
            await this.#updateVault(fileId, mergedVault, keySalt)
        })
    }

    #saveKey(key: CryptoKey) {
        const wasNull = this.#key === null
        this.#key = key
        if (wasNull) {
            const pendingRootIntegrations = this._lockedSyncedRoot.pendingRootIntegrations
            for (const [priority, { file, resolve, reject }] of pendingRootIntegrations.entries()) {
                this.#integrateRoot(file, priority).then(resolve, reject)
            }
            pendingRootIntegrations.clear()
        }
    }

    #syncStorageChanged = (changes: Record<string, browser.Storage.StorageChange>) => {
        if (Object.hasOwn(changes, "rootAddresses")) {
            void this._post("loadRootAddresses()", this.#loadRootAddresses)
        }
    }

    constructor() {
        super()
        browser.storage.sync.onChanged.addListener(this.#syncStorageChanged)
        void this._post("loadRootAddresses()", this.#loadRootAddresses)
        void this._post("loadSetupKey", this.#loadSetupKey)
    }

    get _lockedSyncedRoot(): LockedSyncedRoot {
        if (!this.#lockedSyncedRoot) {
            throw new Error("Invalid state")
        }
        return this.#lockedSyncedRoot
    }
    set _lockedSyncedRoot(lockedSyncedRoot: LockedSyncedRoot | null) {
        this.#lockedSyncedRoot = lockedSyncedRoot
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            hasIdentity: lockedSyncedRoot !== null,
        })
    }

    get hasSuperKey(): boolean {
        return this.#superKey !== null
    }

    addStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.add(statePublisher)
        statePublisher.addEventListener("disconnect", () => this.removeStatePublisher(statePublisher))
        statePublisher.publishPrivileged(this.#privilegedState)
    }

    removeStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.delete(statePublisher)
    }

    integrate(fileId: string, file: Uint8Array, priority: number): Promise<void> {
        if (fileId === ROOT_FILE_ID) {
            return this.#integrateRoot(file, priority)
        } else {
            return this.#integrateVault(fileId, file)
        }
    }

    // Public API
    lock(unenroll: boolean): Promise<void> {
        return this._post("lock()", async () => {
            if (this.#key === null && (!unenroll || !this.#setupKey)) {
                return
            }
            this.#key = null
            this.#superKey = null
            if (this.#superKeyTimer != null) {
                clearTimeout(this.#superKeyTimer)
                this.#superKeyTimer = null
            }
            this.#updatePrivilegedState({
                ...this.#privilegedState,
                isSuper: false,
            })
            this._lockedSyncedRoot = null
            await this.#updateRoot(null)

            if (unenroll) {
                this.#updateSetupKey(null)
            }

            // Re-download the encrypted root file, since we don't
            // retain that after we unlock it.
            for (const syncManager of this.#syncManagers.values()) {
                syncManager.triggerDownload()
            }
        })
    }
    async #unlockInner(masterPassword: string, secretSentence: string | null): Promise<void> {
        const { passwordSalt, sentenceSalt, keySalt, canaryData } = this._lockedSyncedRoot
        const keyFromPassword = await deriveKeyFromPassword(masterPassword, passwordSalt)
        let setupKey = this.#setupKey
        if (secretSentence !== null) {
            const keyFromSentence = await deriveKeyFromPassword(secretSentence, sentenceSalt)
            setupKey = await combineKeys(keyFromSentence, keyFromPassword)
        }
        if (!setupKey) {
            throw new Error("Secret sentence is required to unlock!")
        }

        const superKey = await combineKeys(setupKey, keyFromPassword)
        const key = await deriveKeyFromSuperKey(superKey, keySalt, KeyApplication.rootKey)
        // Test the key against our canary data to know immediately if it's invalid
        try {
            await decrypt(key, canaryData)
        } catch (err) {
            if (err instanceof DOMException && err.name === "OperationError") {
                throw new IncorrectPasswordError()
            } else {
                throw err
            }
        }

        if (secretSentence !== null) {
            this.#updateSetupKey(setupKey)
        }
        this.#saveKey(key)

        if (this.#superKeyTimer != null) {
            clearTimeout(this.#superKeyTimer)
            this.#superKeyTimer = null
        }
        this.#superKey = superKey
        this.#superKeyTimer = setTimeout(() => {
            this.#superKey = null
            this.#superKeyTimer = null
            this.#updatePrivilegedState({
                ...this.#privilegedState,
                isSuper: false,
            })
        }, SUPER_KEY_TIMEOUT)
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isSuper: true,
        })
    }
    unlock(masterPassword: string, secretSentence: string | null): Promise<void> {
        return this._post("unlock()", () => this.#unlockInner(masterPassword, secretSentence))
    }
    createRoot(masterPassword: string, secretSentence: string): Promise<void> {
        return this._post("createRoot(<redacted>)", async () => {
            if (this.#lockedSyncedRoot) {
                throw new Error("Root already exists")
            }
            const passwordSalt = generateSalt()
            const sentenceSalt = generateSalt()
            const keySalt = generateSalt()
            const keyFromPassword = await deriveKeyFromPassword(masterPassword, passwordSalt)
            const keyFromSentence = await deriveKeyFromPassword(secretSentence, sentenceSalt)
            const setupKey = await combineKeys(keyFromSentence, keyFromPassword)

            this.#updateSetupKey(setupKey)

            const superKey = await combineKeys(setupKey, keyFromPassword)
            const key = await deriveKeyFromSuperKey(superKey, keySalt, KeyApplication.rootKey)
            const canaryData = await encrypt(key, new Uint8Array(1))
            const currentTs = Date.now()
            this._lockedSyncedRoot = {
                priority: 0,
                passwordSalt,
                sentenceSalt,
                keySalt,
                canaryData,
                pendingRootIntegrations: new Map()
            }
            this.#saveKey(key)
            await this.#updateRoot({
                uuid: crypto.randomUUID(),
                items: [{
                    uuid: crypto.randomUUID(),
                    creationTimestamp: currentTs,
                    updateTimestamp: currentTs,
                    payload: {
                        id: "rootInfo",
                        name: "Unnamed",
                        secretSentence,
                    }
                }]
            })
        })
    }
    changePassword(oldPassword: string, newPassword: string): Promise<void> {
        return this._post("changePassword(<redacted>, <redacted>)", async () => {
            // Check that old password is valid
            await this.#unlockInner(oldPassword, null)
            const setupKey = this.#setupKey
            if (!setupKey) {
                throw new Error("Secret sentence is required to unlock!")
            }

            // Re-derive all of our salts and keys
            const passwordSalt = generateSalt()
            const keySalt = generateSalt()
            const keyFromPassword = await deriveKeyFromPassword(newPassword, passwordSalt)
            const superKey = await combineKeys(setupKey, keyFromPassword)
            const key = await deriveKeyFromSuperKey(superKey, keySalt, KeyApplication.rootKey)
            const canaryData = await encrypt(key, new Uint8Array(1))
            this._lockedSyncedRoot = {
                ...this._lockedSyncedRoot,
                passwordSalt,
                keySalt,
                canaryData,
            }
            this.#saveKey(key)

            // Save changes to storage
            await this.#saveRootChanges()
        })
    }
    #patchRoot(f: (root: DecryptedRootFile) => DecryptedRootFile, hint?: UpdateRootHint): Promise<void> {
        return this._post(`patchRoot(...)`, async () => {
            if (!this.#root) {
                throw new Error("Locked - cannot update")
            }
            await this.#updateRoot(f(this.#root), hint)
        })
    }
    updateRootName(name: string): Promise<void> {
        return this.#patchRoot(itemPatcher(payload => {
            if (payload?.id === "rootInfo") {
                return {
                    ...payload,
                    name,
                }
            }
            return payload
        }))
    }
    async #requireSuperKey(): Promise<CryptoKey> {
        if (!this.#superKey) {
            await requestUnlock()
            if (!this.#superKey) {
                throw new Error("Failed to unlock")
            }
        }
        return this.#superKey
    }
    async createVault(name: string): Promise<void> {
        const superKey = await this.#requireSuperKey()
        const personalVaultSalt = generateSalt()
        const personalVaultKey = await deriveKeyFromSuperKey(superKey, personalVaultSalt, KeyApplication.personalVaultKey)
        const vaultSuperKey = await generateSuperKey()
        const keySalt = generateSalt()
        const vaultKey = await deriveKeyFromSuperKey(vaultSuperKey, keySalt, KeyApplication.vaultKey)
        const rawVaultKey = await exportKey(vaultKey)
        const encryptedVaultSuperKey = await encryptKey(personalVaultKey, vaultSuperKey)
        const fileId = crypto.randomUUID()
        const vault: DecryptedVaultFile = itemCreator<VaultFileItem, VaultInfoItem>({
            id: "vaultInfo",
            name,
        })(newFile())
        await this.#patchRoot(itemCreator({
            id: "vault",
            fileId,
            addresses: [],
            vaultKey: rawVaultKey,
            personalVaultSalt,
            encryptedVaultSuperKey,
        }), {
            newVaults: { [fileId]: { keySalt, vault } }
        })
    }
    async removeVault(vaultId: string) {
        await this.#patchRoot(itemPatcher((item, _uuid) => item?.id === "vault" && item.fileId === vaultId ? null : item))
    }
    async editVaultStorageAddresses(vaultId: string, f: (addresses: StorageAddress[]) => StorageAddress[]) {
        await this.#patchRoot(itemPatcher((item, _uuid) => {
            if (item?.id !== "vault" || item.fileId !== vaultId) {
                return item
            } else {
                return {
                    ...item,
                    addresses: f(item.addresses)
                }
            }
        }))
    }
    #patchVault(vaultId: string, f: (root: DecryptedVaultFile) => DecryptedVaultFile): Promise<void> {
        return this._post(`patchVault(${vaultId}, ...)`, async () => {
            const vaultState = this.#vaults.get(vaultId)
            if (!vaultState?.vault) {
                throw new Error("No such vault - cannot update")
            }
            await this.#updateVault(vaultId, f(vaultState.vault))
        })
    }
    async #deriveVaultItemKey(vaultId: string, itemSalt: Uint8Array): Promise<CryptoKey> {
        const superKey = await this.#requireSuperKey()
        const vaultDesc = this.#getVaultDesc(vaultId)
        if (!vaultDesc) {
            throw new Error("Vault not found")
        }
        const { personalVaultSalt, encryptedVaultSuperKey } = vaultDesc.payload
        const personalVaultKey = await deriveKeyFromSuperKey(superKey, personalVaultSalt, KeyApplication.personalVaultKey)
        const vaultSuperKey = await decryptKey(personalVaultKey, encryptedVaultSuperKey)
        const vaultItemKey = await deriveKeyFromSuperKey(vaultSuperKey, itemSalt, KeyApplication.itemKey)
        return vaultItemKey
    }
    async #buildItemFromDetails(vaultId: string, details: ItemDetails): Promise<NormalItem> {
        let data: VaultItemData
        if (details.encrypted) {
            const salt = generateSalt()
            const itemKey = await this.#deriveVaultItemKey(vaultId, salt)
            const payload = await encrypt(itemKey, msgpack.encode(details.payload))
            data = {
                encrypted: true,
                salt,
                payload,
            }
        } else {
            data = {
                encrypted: false,
                payload: details.payload,
            }
        }
        return {
            id: "normal",
            name: details.name,
            origin: details.origin,
            data,
        }
    }
    async createVaultItem(vaultId: string, details: ItemDetails): Promise<string> {
        const itemId = crypto.randomUUID()
        const item = await this.#buildItemFromDetails(vaultId, details)
        await this.#patchVault(vaultId, itemCreator(item, itemId))
        return itemId
    }
    async deleteVaultItem(vaultId: string, itemId: string) {
        await this.#patchVault(vaultId, itemPatcher((item, uuid) => uuid === itemId && item?.id === "normal" ? null : item))
    }
    async updateVaultItem(vaultId: string, itemId: string, details: ItemDetails) {
        const updatedItem = await this.#buildItemFromDetails(vaultId, details)
        await this.#patchVault(vaultId, itemPatcher((item, uuid) => uuid === itemId && item?.id === "normal" ? updatedItem : item))
    }
}

export const SECURE_CONTEXT = new SecureContext()
