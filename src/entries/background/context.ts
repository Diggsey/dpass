import { Actor } from "./actor";
import { decodeRootData, DecryptedRootFile, encodeRootData } from "./serialize/rootData";
import { DecryptedVaultFile } from "./serialize/vaultData";
import { objectKey, STORAGE_MANAGER } from "./storage/connection";
import { IIntegrator, SyncManager } from "./sync/manager";
import browser from "webextension-polyfill";
import { PrivilegedState, PrivilegedSyncState, PrivilegedVaultMap, StorageAddress } from "../shared/privileged/state";
import { IStatePublisher } from "./pubsub/state";
import { decodeRoot, encodeRoot } from "./serialize/root";
import { mergeFiles } from "./serialize/merge";


type VaultState = {
    vault: DecryptedVaultFile | null,
    syncManagers: Map<string, SyncManager>,
}

type TimerId = ReturnType<typeof setTimeout>

const ROOT_FILE_ID = "root"
const IV_BYTE_LENGTH = 12
const SALT_BYTE_LENGTH = 32
const ENCRYPTION_KEY_PARAMS = { "name": "AES-GCM", "length": 256 }
const ROOT_KEY_APPLICATION = new TextEncoder().encode("rootKey")

type BrowserClickAction = "autofill" | "requestPassword" | "showOptions" | "none"

type PendingRootIntegration = {
    file: Uint8Array,
    resolve: () => void,
    reject: (err: any) => void,
}

function generateIv(): Uint8Array {
    const iv = new Uint8Array(IV_BYTE_LENGTH)
    return crypto.getRandomValues(iv)
}

function generateSalt(): Uint8Array {
    const salt = new Uint8Array(SALT_BYTE_LENGTH)
    return crypto.getRandomValues(salt)
}

async function deriveSuperKeyFromPassword(masterPassword: string, passwordSalt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        enc.encode(masterPassword),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return await crypto.subtle.deriveKey({
        name: "PBKDF2",
        hash: "SHA-256",
        salt: passwordSalt,
        iterations: 100000,
    }, passwordKey, ENCRYPTION_KEY_PARAMS, false, ["deriveKey"])
}

async function deriveKeyFromSuperKey(superKey: CryptoKey, keySalt: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey({
        name: "HKDF",
        hash: "SHA-256",
        salt: keySalt,
        info: ROOT_KEY_APPLICATION,
    }, superKey, ENCRYPTION_KEY_PARAMS, false, ["encrypt", "decrypt"])
}

async function encrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data))
}

async function decrypt(key: CryptoKey, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data))
}

type LockedSyncedRoot = {
    priority: number,
    passwordSalt: Uint8Array,
    keySalt: Uint8Array,
    pendingRootIntegrations: Map<number, PendingRootIntegration>,
    canaryData: Uint8Array,
    canaryIv: Uint8Array,
}

class SecureContext extends Actor implements IIntegrator {
    #superKey: CryptoKey | null = null
    #superKeyTimer: TimerId | null = null
    #key: CryptoKey | null = null
    #root: DecryptedRootFile | null = null
    #syncManagers: Map<string, SyncManager> = new Map()
    #vaults: Map<string, VaultState> = new Map()
    #rootAddresses: StorageAddress[] = []
    #privilegedState: PrivilegedState = {
        privileged: true,
        hasRoot: false,
        rootAddresses: [],
        vaults: {},
        syncState: {},
        keyPairs: {},
    }
    #statePublishers: Set<IStatePublisher> = new Set()
    #statePublishTimer: TimerId | null = null
    #lockedSyncedRoot: LockedSyncedRoot | null = null

    constructor() {
        super()
        this._post(() => this.#loadRootAddresses())
    }

    get currentClickAction(): BrowserClickAction {
        if (this.#rootAddresses.length === 0) {
            return "showOptions"
        } else if (this.#key === null) {
            return "requestPassword"
        } else {
            return "autofill"
        }
    }

    get hasSuperKey(): boolean {
        return this.#superKey !== null
    }

    async #loadRootAddresses() {
        const res = await browser.storage.sync.get("rootAddresses")
        if (res.rootAddresses) {
            this.#updateRootAddresses(res.rootAddresses)
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

    addStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.add(statePublisher)
        statePublisher.addEventListener("disconnected", () => this.removeStatePublisher(statePublisher))
        statePublisher.publishPrivileged(this.#privilegedState)
    }

    removeStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.delete(statePublisher)
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
                lastError: v.lastError,
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
                const vaultsUpdater: PrivilegedVaultMap = {}
                vaultsUpdater[fileId] = {
                    ...vault,
                    syncState,
                }
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    vaults: {
                        ...this.#privilegedState.vaults,
                        ...vaultsUpdater,
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
                this._post(() => this.#setupSyncManager(fileId, address, i))
            }
        }
        for (const syncManager of oldMap.values()) {
            syncManager.dispose()
        }
        if (oldMap.size > 0) {
            this.#syncStateChanged(fileId)
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
        const storage = await STORAGE_MANAGER.open(address)
        const syncManager = new SyncManager(storage, fileId, this, priority)
        syncManager.addEventListener("busychanged", () => {
            this._post(async () => {
                this.#syncStateChanged(fileId)
            })
        })
        map.set(addressKey, syncManager)
        this.#syncStateChanged(fileId)
    }

    #updateRootAddresses(rootAddresses: StorageAddress[]) {
        this.#rootAddresses = rootAddresses
        this.#syncManagers = this.#updateSyncManagersFromAddresses(ROOT_FILE_ID, this.#rootAddresses, this.#syncManagers)
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            rootAddresses: this.#rootAddresses,
        })
    }

    async #saveRootChanges() {
        if (this.#key && this.#root && this.#lockedSyncedRoot) {
            // Upload vault changes
            const encodedData = encodeRootData(this.#root)
            const iv = generateIv()
            const encryptedData = await encrypt(this.#key, iv, encodedData)
            const file = encodeRoot({
                passwordSalt: this.#lockedSyncedRoot.passwordSalt,
                keySalt: this.#lockedSyncedRoot.keySalt,
                iv,
                encryptedData: new Uint8Array(encryptedData),
            })
            for (const syncManager of this.#syncManagers.values()) {
                syncManager.onDataChanged(file)
            }
        }
    }

    async #updateRoot(newRoot: DecryptedRootFile | null) {
        this.#root = newRoot
        let newVaults = new Map<string, VaultState>()
        if (this.#root) {
            // Connect to new vault addresses
            for (const item of this.#root.items) {
                if (item.payload?.id === "vault") {
                    const { fileId, addresses } = item.payload
                    let vaultState = this.#vaults.get(fileId)
                    if (!vaultState) {
                        vaultState = { vault: null, syncManagers: new Map() }
                    }
                    vaultState.syncManagers = this.#updateSyncManagersFromAddresses(fileId, addresses, vaultState.syncManagers)
                    newVaults.set(fileId, vaultState)
                }
            }
        }
        await this.#saveRootChanges()
        this.#vaults = newVaults

        this.#updatePrivilegedState({
            ...this.#privilegedState,
            hasRoot: this.#root !== null,
            vaults: {},
            keyPairs: {},
        })
    }

    async #integrateRoot(file: Uint8Array, priority: number) {
        const { version, passwordSalt, keySalt, iv, encryptedData } = decodeRoot(file)
        if (this.#key === null) {
            if (!this.#lockedSyncedRoot || priority <= this.#lockedSyncedRoot.priority) {
                this.#lockedSyncedRoot = {
                    priority,
                    passwordSalt,
                    keySalt,
                    pendingRootIntegrations: this.#lockedSyncedRoot?.pendingRootIntegrations || new Map(),
                    canaryData: encryptedData,
                    canaryIv: iv,
                }
            }
            const pendingRootIntegrations = this.#lockedSyncedRoot.pendingRootIntegrations
            await new Promise<void>((resolve, reject) => {
                pendingRootIntegrations.set(priority, { file, resolve, reject })
            })
        } else {
            const buffer = await decrypt(this.#key, iv, encryptedData)
            const downloadedRoot = decodeRootData(new Uint8Array(buffer), version)
            await this._post(async () => {
                const mergedRoot = this.#root ? mergeFiles(this.#root, downloadedRoot) : downloadedRoot
                this.#updateRoot(mergedRoot)
            })

        }
    }

    async #integrateVault(_fileId: string, _file: Uint8Array) {
        throw new Error("not implemented")
    }

    integrate(fileId: string, file: Uint8Array, priority: number): Promise<void> {
        if (fileId === ROOT_FILE_ID) {
            return this.#integrateRoot(file, priority)
        } else {
            return this.#integrateVault(fileId, file)
        }
    }
    get _lockedSyncedRoot(): LockedSyncedRoot {
        if (!this.#lockedSyncedRoot) {
            throw new Error("Invalid state")
        }
        return this.#lockedSyncedRoot
    }
    #updateKey(key: CryptoKey) {
        if (this.#key === null) {
            this.#key = key
            const pendingRootIntegrations = this._lockedSyncedRoot.pendingRootIntegrations
            for (const [priority, { file, resolve, reject }] of pendingRootIntegrations.entries()) {
                this._post(async () => {
                    try {
                        await this.#integrateRoot(file, priority)
                        resolve()
                    } catch (err) {
                        reject(err)
                    }
                })
            }
            pendingRootIntegrations.clear()
        }
    }

    unlock(masterPassword: string) {
        return this._post(async () => {
            const { passwordSalt, keySalt, canaryIv, canaryData } = this._lockedSyncedRoot
            const superKey = await deriveSuperKeyFromPassword(masterPassword, passwordSalt)
            const key = await deriveKeyFromSuperKey(superKey, keySalt)
            // Test the key against our canary data to know immediately if it's invalid
            await decrypt(key, canaryIv, canaryData)

            this.#updateKey(key)

            if (this.#superKeyTimer != null) {
                clearTimeout(this.#superKeyTimer)
                this.#superKeyTimer = null
            }
            this.#superKey = superKey
            this.#superKeyTimer = setTimeout(() => {
                this.#superKey = null
                this.#superKeyTimer = null
            })
        })
    }
    syncStorageChanged(changes: Record<string, browser.Storage.StorageChange>) {
        if (Object.hasOwn(changes, "rootAddresses")) {
            this._post(() => this.#loadRootAddresses())
        }
    }
    async createRoot(masterPassword: string) {
        return this._post(async () => {
            if (this.#lockedSyncedRoot) {
                throw new Error("Root already exists")
            }
            const passwordSalt = generateSalt()
            const keySalt = generateSalt()
            const superKey = await deriveSuperKeyFromPassword(masterPassword, passwordSalt)
            const key = await deriveKeyFromSuperKey(superKey, keySalt)
            const canaryIv = generateIv()
            const canaryData = await encrypt(key, canaryIv, new Uint8Array(1))
            this.#lockedSyncedRoot = {
                priority: 0,
                passwordSalt,
                keySalt,
                canaryIv,
                canaryData,
                pendingRootIntegrations: new Map()
            }
            this.#updateKey(key)
            this.#updateRoot({
                uuid: crypto.randomUUID(),
                items: []
            })
        })

    }
}

export const SECURE_CONTEXT = new SecureContext()

browser.storage.sync.onChanged.addListener(SECURE_CONTEXT.syncStorageChanged)
