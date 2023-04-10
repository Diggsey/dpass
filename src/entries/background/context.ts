import { Actor } from "./actor"
import {
    decodeRootData,
    DecryptedRootFile,
    encodeRootData,
    KeyPair,
    RootFileItem,
    RootInfo,
    Vault,
} from "./serialize/rootData"
import {
    decodeVaultData,
    DecryptedVaultFile,
    encodeVaultData,
    NormalItem,
    VaultFileItem,
    VaultInfoItem,
    VaultItemData,
} from "./serialize/vaultData"
import { IIntegrator } from "./sync/manager"
import {
    PrivilegedState,
    PrivilegedVault,
    StorageAddress,
} from "../shared/privileged/state"
import { IStatePublisher } from "./pubsub/state"
import { decodeRoot, encodeRoot } from "./serialize/root"
import {
    areFilesEqual,
    extractItems,
    itemCreator,
    itemPatcher,
    MergeableItem,
    mergeFiles,
    newFile,
} from "./serialize/merge"
import {
    combineKeys,
    decrypt,
    decryptKey,
    deriveKeyFromSuperKey,
    deriveSuperKeyFromPassword as deriveKeyFromPassword,
    encrypt,
    encryptKey,
    exportKey,
    generateSalt,
    generateSuperKey,
    importKey,
    KeyApplication,
} from "./crypto"
import { requestUnlock } from "./unlock"
import { decodeVault, encodeVault } from "./serialize/vault"
import * as msgpack from "@msgpack/msgpack"
import { VaultItemPayload } from "../shared/state"
import { ItemDetails } from "../shared/messages/vault"
import { SetupKeyContext } from "./context/setupKeyContext"
import { SuperKeyContext } from "./context/superKeyContext"
import { SyncManagerContext } from "./context/syncManagerContext"
import { RootAddressesContext } from "./context/rootAddressesContext"

type VaultState = {
    keySalt: Uint8Array | null
    vault: DecryptedVaultFile | null
}
type NewVaultHint = {
    keySalt: Uint8Array
    vault: DecryptedVaultFile
}

type UpdateRootHint = {
    newVaults?: { [vaultId: string]: NewVaultHint }
    forceSave?: boolean
}

type TimerId = ReturnType<typeof setTimeout>

export const ROOT_FILE_ID = "root"

type PendingRootIntegration = {
    file: Uint8Array
    resolve: () => void
    reject: (err: unknown) => void
}

type LockedSyncedRoot = {
    priority: number
    passwordSalt: Uint8Array
    sentenceSalt: Uint8Array
    keySalt: Uint8Array
    pendingRootIntegrations: Map<number, PendingRootIntegration>
    canaryData: Uint8Array
}

class IncorrectPasswordError extends Error {
    constructor(wasEnrolling: boolean) {
        super(
            wasEnrolling
                ? "Incorrect password or secret sentence."
                : "Incorrect password."
        )
    }
}

class SecureContext
    extends RootAddressesContext(
        SyncManagerContext(SuperKeyContext(SetupKeyContext(Actor)))
    )
    implements IIntegrator
{
    #key: CryptoKey | null = null
    #root: DecryptedRootFile | null = null
    #vaults: Map<string, VaultState> = new Map()
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
        defaultVaultId: null,
    }
    #statePublishers: Set<IStatePublisher> = new Set()
    #statePublishTimer: TimerId | null = null
    #lockedSyncedRoot: LockedSyncedRoot | null = null

    _setupKeyChanged(): void {
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isSetUp: this._setupKey !== null,
        })
    }

    _superKeyChanged(): void {
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isSuper: this._superKey !== null,
        })
    }

    _syncStateChanged(fileId: string) {
        const syncState = this._getSyncState(fileId)
        if (fileId === ROOT_FILE_ID) {
            this.#updatePrivilegedState({
                ...this.#privilegedState,
                syncState,
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
                    },
                })
            }
        }
    }

    async _dataRequested(fileId: string, addressKey: string): Promise<void> {
        if (fileId === ROOT_FILE_ID) {
            await this.#saveRootChanges(addressKey)
        } else {
            await this.#saveVaultChanges(fileId, addressKey)
        }
    }

    async _rootAddressesChanged(): Promise<void> {
        this._updateSyncManagers(ROOT_FILE_ID, this._rootAddresses)
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            rootAddresses: this._rootAddresses,
        })
        if (this._rootAddresses.length === 0) {
            await this.#lockInner(true)
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
            this._saveChanges(ROOT_FILE_ID, file, addressKey)
        }
    }

    async #updateRoot(
        newRoot: DecryptedRootFile | null,
        hint?: UpdateRootHint
    ) {
        // Do nothing if there are no changes
        if (areFilesEqual(this.#root, newRoot) && !hint?.forceSave) {
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
                        vaultState = (hint?.newVaults &&
                            hint.newVaults[fileId]) || {
                            keySalt: null,
                            vault: null,
                        }
                    }
                    newVaults.set(fileId, vaultState)
                    this._updateSyncManagers(fileId, addresses)
                }
            }
        }
        // Disconnect from old vault addresses
        for (const vaultId of this.#vaults.keys()) {
            this._updateSyncManagers(vaultId, [])
        }
        this.#vaults = newVaults
        await this.#saveRootChanges()

        // Extract "root info" item
        const rootInfo =
            this.#root &&
            extractItems(
                this.#root,
                (item): item is MergeableItem<RootInfo> =>
                    item.payload.id === "rootInfo"
            )[0]

        // Extract "vault" items
        let defaultVaultId: string | null = null
        let defaultVaultTimestamp: number | null = null
        const vaults = this.#root
            ? Object.fromEntries(
                  extractItems(
                      this.#root,
                      (item): item is MergeableItem<Vault> =>
                          item.payload.id === "vault"
                  ).map((vault) => {
                      const setAsDefaultOn = vault.payload.setAsDefaultOn
                      if (
                          setAsDefaultOn !== undefined &&
                          (defaultVaultTimestamp === null ||
                              setAsDefaultOn > defaultVaultTimestamp)
                      ) {
                          defaultVaultId = vault.payload.fileId
                          defaultVaultTimestamp = setAsDefaultOn
                      }
                      const vaultState = this.#vaults.get(vault.payload.fileId)
                      if (!vaultState) {
                          throw new Error(
                              "Vault state should have been initialized"
                          )
                      }
                      const prevVault =
                          this.#privilegedState.vaults[vault.payload.fileId] ||
                          this.#computePrivilegedVaultState(vaultState.vault)
                      return [
                          vault.payload.fileId,
                          {
                              ...prevVault,
                              addresses: vault.payload.addresses,
                              syncState: prevVault?.syncState || {},
                          },
                      ]
                  })
              )
            : {}

        // Extract "key-pair" items
        const keyPairs = this.#root
            ? Object.fromEntries(
                  extractItems(
                      this.#root,
                      (item): item is MergeableItem<KeyPair> =>
                          item.payload.id === "keyPair"
                  ).map((keyPair) => {
                      return [
                          keyPair.uuid,
                          {
                              name: keyPair.payload.name,
                              creationTimestamp: keyPair.creationTimestamp,
                              updateTimestamp: keyPair.updateTimestamp,
                              publicKey: keyPair.payload.publicKey,
                          },
                      ]
                  })
              )
            : {}

        this.#updatePrivilegedState({
            ...this.#privilegedState,
            isUnlocked: this.#root !== null,
            rootInfo: rootInfo &&
                this.#root && {
                    ...rootInfo.payload,
                    creationTimestamp: rootInfo.creationTimestamp,
                    updateTimestamp: Math.max(
                        ...this.#root.items.map((item) => item.updateTimestamp)
                    ),
                },
            vaults,
            keyPairs,
            defaultVaultId,
        })
    }

    async #integrateRoot(file: Uint8Array, priority: number) {
        const { version, passwordSalt, sentenceSalt, keySalt, encryptedData } =
            decodeRoot(file)
        if (this.#key === null) {
            if (
                !this.#lockedSyncedRoot ||
                priority <= this.#lockedSyncedRoot.priority
            ) {
                this._lockedSyncedRoot = {
                    priority,
                    passwordSalt,
                    sentenceSalt,
                    keySalt,
                    pendingRootIntegrations:
                        this.#lockedSyncedRoot?.pendingRootIntegrations ||
                        new Map(),
                    canaryData: encryptedData,
                }
                this.#updatePrivilegedState({
                    ...this.#privilegedState,
                    hasIdentity: true,
                })
            }
            const pendingRootIntegrations =
                this._lockedSyncedRoot.pendingRootIntegrations
            await new Promise<void>((resolve, reject) => {
                pendingRootIntegrations.set(priority, { file, resolve, reject })
            })
        } else {
            const buffer = await decrypt(this.#key, encryptedData)
            const downloadedRoot = decodeRootData(
                new Uint8Array(buffer),
                version
            )
            await this._post("mergeAndUpdateRoot(...)", async () => {
                const mergedRoot = this.#root
                    ? mergeFiles(this.#root, downloadedRoot)
                    : downloadedRoot
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
        this._saveChanges(vaultId, file, addressKey)
    }

    #computePrivilegedVaultState(
        vault: DecryptedVaultFile | null
    ): PrivilegedVault {
        if (!vault) {
            return {
                creationTimestamp: 0,
                updateTimestamp: 0,
                name: "<Unknown>",
                items: {},
                addresses: [],
                syncState: {},
                missing: true,
            }
        }

        // Extract "vault info" item
        const vaultInfo = extractItems(
            vault,
            (item): item is MergeableItem<VaultInfoItem> =>
                item.payload.id === "vaultInfo"
        )[0]
        if (!vaultInfo) {
            throw new Error("Missing vault info")
        }

        // Extract normal items
        const normalItems = extractItems(
            vault,
            (item): item is MergeableItem<NormalItem> =>
                item.payload.id === "normal"
        )

        return {
            creationTimestamp: vaultInfo.creationTimestamp,
            updateTimestamp: Math.max(
                ...vault.items.map((item) => item.updateTimestamp)
            ),
            name: vaultInfo.payload.name,
            items: Object.fromEntries(
                normalItems.map((normalItem) => [
                    normalItem.uuid,
                    {
                        creationTimestamp: normalItem.creationTimestamp,
                        updateTimestamp: normalItem.updateTimestamp,
                        name: normalItem.payload.name,
                        origins: normalItem.payload.origins,
                        data: normalItem.payload.data.encrypted
                            ? { encrypted: true }
                            : {
                                  encrypted: false,
                                  payload: normalItem.payload.data.payload,
                              },
                    },
                ])
            ),
            addresses: [],
            syncState: {},
            missing: false,
        }
    }

    async #updateVault(
        vaultId: string,
        newVault: DecryptedVaultFile,
        keySalt?: Uint8Array
    ) {
        const prevVaultState = this.#vaults.get(vaultId)
        if (!prevVaultState) {
            return
        }
        if (
            areFilesEqual(prevVaultState.vault, newVault) &&
            (!keySalt || keySalt === prevVaultState.keySalt)
        ) {
            return
        }
        this.#vaults.set(vaultId, {
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
        return extractItems(
            this.#root,
            (item): item is MergeableItem<Vault> =>
                item.payload.id === "vault" && item.payload.fileId === vaultId
        )[0]
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
            const mergedVault = vaultState?.vault
                ? mergeFiles(vaultState.vault, downloadedVault)
                : downloadedVault
            await this.#updateVault(fileId, mergedVault, keySalt)
        })
    }

    #saveKey(key: CryptoKey) {
        const wasNull = this.#key === null
        this.#key = key
        if (wasNull) {
            const pendingRootIntegrations =
                this._lockedSyncedRoot.pendingRootIntegrations
            for (const [
                priority,
                { file, resolve, reject },
            ] of pendingRootIntegrations.entries()) {
                this.#integrateRoot(file, priority).then(resolve, reject)
            }
            pendingRootIntegrations.clear()
        }
    }

    get _lockedSyncedRoot(): LockedSyncedRoot {
        if (!this.#lockedSyncedRoot) {
            throw new Error("Invalid state")
        }
        return this.#lockedSyncedRoot
    }
    set _lockedSyncedRoot(lockedSyncedRoot: LockedSyncedRoot | null) {
        if (!lockedSyncedRoot && this.#lockedSyncedRoot) {
            for (const pendingIntegration of this.#lockedSyncedRoot
                .pendingRootIntegrations) {
                pendingIntegration[1].reject(new Error("Cancelled"))
            }
            this.#lockedSyncedRoot.pendingRootIntegrations.clear()
        }

        this.#lockedSyncedRoot = lockedSyncedRoot
        this.#updatePrivilegedState({
            ...this.#privilegedState,
            hasIdentity: lockedSyncedRoot !== null,
        })
    }

    addStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.add(statePublisher)
        statePublisher.addEventListener("disconnect", () =>
            this.removeStatePublisher(statePublisher)
        )
        statePublisher.publishPrivileged(this.#privilegedState)
    }

    removeStatePublisher(statePublisher: IStatePublisher) {
        this.#statePublishers.delete(statePublisher)
    }

    integrate(
        fileId: string,
        file: Uint8Array,
        priority: number
    ): Promise<void> {
        if (fileId === ROOT_FILE_ID) {
            return this.#integrateRoot(file, priority)
        } else {
            return this.#integrateVault(fileId, file)
        }
    }

    async #lockInner(unenroll: boolean) {
        this.#key = null
        this._superKey = null
        this._lockedSyncedRoot = null
        await this.#updateRoot(null)

        if (unenroll) {
            this._setupKey = null
        }

        // Re-download the encrypted root file, since we don't
        // retain that after we unlock it.
        this._refetchData(ROOT_FILE_ID)
    }

    // Public API
    lock(unenroll: boolean): Promise<void> {
        return this._post("lock()", async () => {
            if (this.#key === null && (!unenroll || !this._setupKey)) {
                return
            }
            await this.#lockInner(unenroll)
        })
    }
    async #unlockInner(
        masterPassword: string,
        secretSentence: string | null
    ): Promise<void> {
        const { passwordSalt, sentenceSalt, keySalt, canaryData } =
            this._lockedSyncedRoot
        const keyFromPassword = await deriveKeyFromPassword(
            masterPassword,
            passwordSalt
        )
        let setupKey = this._setupKey
        if (secretSentence !== null) {
            const keyFromSentence = await deriveKeyFromPassword(
                secretSentence,
                sentenceSalt
            )
            setupKey = await combineKeys(keyFromSentence, keyFromPassword)
        }
        if (!setupKey) {
            throw new Error("Secret sentence is required to unlock!")
        }

        const superKey = await combineKeys(setupKey, keyFromPassword)
        const key = await deriveKeyFromSuperKey(
            superKey,
            keySalt,
            KeyApplication.rootKey
        )
        // Test the key against our canary data to know immediately if it's invalid
        try {
            await decrypt(key, canaryData)
        } catch (err) {
            if (err instanceof DOMException && err.name === "OperationError") {
                throw new IncorrectPasswordError(secretSentence !== null)
            } else {
                throw err
            }
        }

        if (secretSentence !== null) {
            this._setupKey = setupKey
        }
        this.#saveKey(key)
        this._superKey = superKey
    }
    unlock(
        masterPassword: string,
        secretSentence: string | null
    ): Promise<void> {
        return this._post("unlock()", () =>
            this.#unlockInner(masterPassword, secretSentence)
        )
    }
    createRoot(
        name: string,
        masterPassword: string,
        secretSentence: string
    ): Promise<void> {
        return this._post("createRoot(<redacted>)", async () => {
            if (this.#lockedSyncedRoot) {
                throw new Error("Root already exists")
            }
            const passwordSalt = generateSalt()
            const sentenceSalt = generateSalt()
            const keySalt = generateSalt()
            const keyFromPassword = await deriveKeyFromPassword(
                masterPassword,
                passwordSalt
            )
            const keyFromSentence = await deriveKeyFromPassword(
                secretSentence,
                sentenceSalt
            )
            this._setupKey = await combineKeys(keyFromSentence, keyFromPassword)

            const superKey = await combineKeys(this._setupKey, keyFromPassword)
            const key = await deriveKeyFromSuperKey(
                superKey,
                keySalt,
                KeyApplication.rootKey
            )
            const canaryData = await encrypt(key, new Uint8Array(1))
            const currentTs = Date.now()
            this._lockedSyncedRoot = {
                priority: 0,
                passwordSalt,
                sentenceSalt,
                keySalt,
                canaryData,
                pendingRootIntegrations: new Map(),
            }
            this.#saveKey(key)
            this._superKey = superKey

            await this.#updateRoot({
                uuid: crypto.randomUUID(),
                items: [
                    {
                        uuid: crypto.randomUUID(),
                        creationTimestamp: currentTs,
                        updateTimestamp: currentTs,
                        payload: {
                            id: "rootInfo",
                            name,
                            secretSentence,
                        },
                    },
                ],
            })
        })
    }
    changePassword(
        oldPassword: string,
        newPassword: string | null,
        newSentence: string | null
    ): Promise<void> {
        return this._post(
            "changePassword(<redacted>, <redacted>, <redacted>)",
            async () => {
                // Check that old password is valid
                await this.#unlockInner(oldPassword, null)

                const oldSentence =
                    this.#privilegedState.rootInfo?.secretSentence
                if (oldSentence === undefined) {
                    throw new Error("Secret sentence not set")
                }

                // Re-derive all of our salts and keys
                const passwordSalt = generateSalt()
                const sentenceSalt = generateSalt()
                const keySalt = generateSalt()
                const keyFromPassword = await deriveKeyFromPassword(
                    newPassword ?? oldPassword,
                    passwordSalt
                )
                const keyFromSentence = await deriveKeyFromPassword(
                    newSentence ?? oldSentence,
                    sentenceSalt
                )
                this._setupKey = await combineKeys(
                    keyFromSentence,
                    keyFromPassword
                )

                const superKey = await combineKeys(
                    this._setupKey,
                    keyFromPassword
                )
                const key = await deriveKeyFromSuperKey(
                    superKey,
                    keySalt,
                    KeyApplication.rootKey
                )

                const canaryData = await encrypt(key, new Uint8Array(1))
                this._lockedSyncedRoot = {
                    ...this._lockedSyncedRoot,
                    passwordSalt,
                    sentenceSalt,
                    keySalt,
                    canaryData,
                }
                this.#saveKey(key)
                this._superKey = superKey

                if (newSentence !== null && this.#root !== null) {
                    const rootInfoPatcher = itemPatcher<RootFileItem>(
                        (payload) => {
                            if (payload?.id === "rootInfo") {
                                return {
                                    ...payload,
                                    secretSentence: newSentence,
                                }
                            }
                            return payload
                        }
                    )
                    await this.#updateRoot(rootInfoPatcher(this.#root), {
                        forceSave: true,
                    })
                } else {
                    // Save changes to storage
                    await this.#saveRootChanges()
                }
            }
        )
    }
    #patchRoot(
        f: (root: DecryptedRootFile) => DecryptedRootFile,
        hint?: UpdateRootHint
    ): Promise<void> {
        return this._post(`patchRoot(...)`, async () => {
            if (!this.#root) {
                throw new Error("Locked - cannot update")
            }
            await this.#updateRoot(f(this.#root), hint)
        })
    }
    updateRootName(name: string): Promise<void> {
        return this.#patchRoot(
            itemPatcher((payload) => {
                if (payload?.id === "rootInfo") {
                    return {
                        ...payload,
                        name,
                    }
                }
                return payload
            })
        )
    }
    updateVaultName(vaultId: string, name: string): Promise<void> {
        return this.#patchVault(
            vaultId,
            itemPatcher((payload) => {
                if (payload?.id === "vaultInfo") {
                    return {
                        ...payload,
                        name,
                    }
                }
                return payload
            })
        )
    }
    async #requireSuperKey(): Promise<CryptoKey> {
        if (!this._superKey) {
            await requestUnlock()
            if (!this._superKey) {
                throw new Error("Failed to unlock")
            }
        }
        return this._superKey
    }
    async createVault(name: string, copyStorage: boolean): Promise<string> {
        const superKey = await this.#requireSuperKey()
        const personalVaultSalt = generateSalt()
        const personalVaultKey = await deriveKeyFromSuperKey(
            superKey,
            personalVaultSalt,
            KeyApplication.personalVaultKey
        )
        const vaultSuperKey = await generateSuperKey()
        const keySalt = generateSalt()
        const vaultKey = await deriveKeyFromSuperKey(
            vaultSuperKey,
            keySalt,
            KeyApplication.vaultKey
        )
        const rawVaultKey = await exportKey(vaultKey)
        const encryptedVaultSuperKey = await encryptKey(
            personalVaultKey,
            vaultSuperKey
        )
        const fileId = crypto.randomUUID()
        const vault: DecryptedVaultFile = itemCreator<
            VaultFileItem,
            VaultInfoItem
        >({
            id: "vaultInfo",
            name,
        })(newFile())
        // If there is no default vault, make this vault the default
        const setAsDefaultOn = this.#privilegedState.defaultVaultId
            ? undefined
            : Date.now()

        const addresses: readonly StorageAddress[] = copyStorage
            ? this.#privilegedState.rootAddresses
            : [
                  {
                      id: "local",
                      folderName: "default",
                  },
              ]

        await this.#patchRoot(
            itemCreator({
                id: "vault",
                fileId,
                addresses,
                vaultKey: rawVaultKey,
                personalVaultSalt,
                encryptedVaultSuperKey,
                setAsDefaultOn,
            }),
            {
                newVaults: { [fileId]: { keySalt, vault } },
            }
        )
        return fileId
    }
    async removeVault(vaultId: string) {
        await this.#patchRoot(
            itemPatcher((item, _uuid) =>
                item?.id === "vault" && item.fileId === vaultId ? null : item
            )
        )
    }
    async editVaultStorageAddresses(
        vaultId: string,
        f: (addresses: readonly StorageAddress[]) => readonly StorageAddress[]
    ) {
        await this.#patchRoot(
            itemPatcher((item, _uuid) => {
                if (item?.id !== "vault" || item.fileId !== vaultId) {
                    return item
                } else {
                    return {
                        ...item,
                        addresses: f(item.addresses),
                    }
                }
            })
        )
    }
    #patchVault(
        vaultId: string,
        f: (root: DecryptedVaultFile) => DecryptedVaultFile
    ): Promise<void> {
        return this._post(`patchVault(${vaultId}, ...)`, async () => {
            const vaultState = this.#vaults.get(vaultId)
            if (!vaultState?.vault) {
                throw new Error("No such vault - cannot update")
            }
            await this.#updateVault(vaultId, f(vaultState.vault))
        })
    }
    async #deriveVaultItemKey(
        vaultId: string,
        itemSalt: Uint8Array
    ): Promise<CryptoKey> {
        const superKey = await this.#requireSuperKey()
        const vaultDesc = this.#getVaultDesc(vaultId)
        if (!vaultDesc) {
            throw new Error("Vault not found")
        }
        const { personalVaultSalt, encryptedVaultSuperKey } = vaultDesc.payload
        const personalVaultKey = await deriveKeyFromSuperKey(
            superKey,
            personalVaultSalt,
            KeyApplication.personalVaultKey
        )
        const vaultSuperKey = await decryptKey(
            personalVaultKey,
            encryptedVaultSuperKey
        )
        const vaultItemKey = await deriveKeyFromSuperKey(
            vaultSuperKey,
            itemSalt,
            KeyApplication.itemKey
        )
        return vaultItemKey
    }
    async #buildItemDataFromPayload(
        vaultId: string,
        payload: VaultItemPayload,
        encrypted: boolean
    ): Promise<VaultItemData> {
        if (encrypted) {
            const salt = generateSalt()
            const itemKey = await this.#deriveVaultItemKey(vaultId, salt)
            return {
                encrypted: true,
                salt,
                payload: await encrypt(itemKey, msgpack.encode(payload)),
            }
        } else {
            return {
                encrypted: false,
                payload,
            }
        }
    }
    async createVaultItem(
        vaultId: string,
        details: ItemDetails
    ): Promise<string> {
        const itemId = crypto.randomUUID()
        const { payload, encrypted, ...rest } = details
        const data = await this.#buildItemDataFromPayload(
            vaultId,
            payload || { fields: [] },
            encrypted
        )
        await this.#patchVault(
            vaultId,
            itemCreator(
                {
                    id: "normal",
                    ...rest,
                    data,
                },
                itemId
            )
        )
        return itemId
    }
    async deleteVaultItem(vaultId: string, itemId: string) {
        await this.#patchVault(
            vaultId,
            itemPatcher((item, uuid) =>
                uuid === itemId && item?.id === "normal" ? null : item
            )
        )
    }
    async updateVaultItem(
        vaultId: string,
        itemId: string,
        details: ItemDetails
    ) {
        const { payload, encrypted, ...rest } = details
        const data =
            payload &&
            (await this.#buildItemDataFromPayload(vaultId, payload, encrypted))
        await this.#patchVault(
            vaultId,
            itemPatcher((item, uuid) =>
                uuid === itemId && item?.id === "normal"
                    ? {
                          id: "normal",
                          ...rest,
                          data: data || item.data,
                      }
                    : item
            )
        )
    }
    getVaultItem(vaultId: string, itemId: string): NormalItem {
        const vaultState = this.#vaults.get(vaultId)
        if (!vaultState?.vault) {
            throw new Error("No such vault - cannot decrypt item")
        }
        const item = extractItems(
            vaultState.vault,
            (item): item is MergeableItem<NormalItem> =>
                item.payload.id === "normal" && item.uuid === itemId
        )[0]
        if (!item) {
            throw new Error("No such item")
        }
        return item.payload
    }
    async decryptVaultItem(
        vaultId: string,
        itemId: string
    ): Promise<VaultItemPayload> {
        const payload = this.getVaultItem(vaultId, itemId)
        if (!payload.data.encrypted) {
            throw new Error("No such encrypted item")
        }
        const itemKey = await this.#deriveVaultItemKey(
            vaultId,
            payload.data.salt
        )
        const buffer = await decrypt(itemKey, payload.data.payload)
        return msgpack.decode(buffer) as VaultItemPayload
    }
    async setVaultAsDefault(vaultId: string): Promise<void> {
        const setAsDefaultOn = Date.now()
        await this.#patchRoot(
            itemPatcher((item, _uuid) => {
                if (item?.id !== "vault" || item.fileId !== vaultId) {
                    return item
                } else {
                    return {
                        ...item,
                        setAsDefaultOn,
                    }
                }
            })
        )
    }
}

export const SECURE_CONTEXT = new SecureContext()
