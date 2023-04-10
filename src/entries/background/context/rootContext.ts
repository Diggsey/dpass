import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import {
    decodeRootData,
    DecryptedRootFile,
    encodeRootData,
    RootInfo,
} from "../serialize/rootData"
import {
    combineKeys,
    decrypt,
    deriveKeyFromPassword,
    deriveKeyFromSuperKey,
    encrypt,
    generateSalt,
    KeyApplication,
} from "../crypto"
import { decodeRoot, encodeRoot } from "../serialize/root"
import { ISyncManagerContext } from "./syncManagerContext"
import { DecryptedVaultFile } from "../serialize/vaultData"
import {
    areFilesEqual,
    extractItems,
    MergeableItem,
    mergeFiles,
} from "../serialize/merge"
import { ISetupKeyContext } from "./setupKeyContext"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { StorageAddress } from "~/entries/shared/privileged/state"

class IncorrectPasswordError extends Error {
    constructor(wasEnrolling: boolean) {
        super(
            wasEnrolling
                ? "Incorrect password or secret sentence."
                : "Incorrect password."
        )
    }
}

export type NewVaultHint = {
    keySalt: Uint8Array
    vault: DecryptedVaultFile
}

export const ROOT_FILE_ID = "root"

type LockedSyncedRoot = {
    priority: number
    passwordSalt: Uint8Array
    sentenceSalt: Uint8Array
    keySalt: Uint8Array
    canaryData: Uint8Array
}

type BackgroundTask<T> = {
    promise: Promise<T>
}

export interface IRootContext {
    get _root(): DecryptedRootFile | null
    get _rootInfo(): MergeableItem<RootInfo> | null
    get _hasIdentity(): boolean

    _saveRootChanges(address?: StorageAddress): Promise<boolean>
    _updateRoot(
        newRoot: DecryptedRootFile | null,
        hint?: UpdateRootHint
    ): Promise<void>
    _patchRoot(
        f: (root: DecryptedRootFile) => DecryptedRootFile,
        hint?: UpdateRootHint
    ): Promise<void>
    _recreateEncryptedRoot(
        masterPassword: string,
        secretSentence: string
    ): Promise<void>
    _encryptRoot(unenroll: boolean): Promise<void>
    _decryptRoot(
        masterPassword: string,
        secretSentence: string | null
    ): Promise<void>

    // Must implement
    _rootChanged(hint?: UpdateRootHint): void
    _hasIdentityChanged(): void
}

export type UpdateRootHint = {
    newVaults?: { [vaultId: string]: NewVaultHint }
    forceSave?: boolean
}

type PendingRootIntegration = {
    file: Uint8Array
    resolve: () => void
    reject: (err: unknown) => void
}

// Handles loading and updating the setup key
export const RootContext = mixin<
    IRootContext,
    Actor &
        ISyncManagerContext &
        ISetupKeyContext &
        ISuperKeyContext &
        IRootAddressesContext
>((Base) =>
    Decorated(
        class RootContext extends Base implements IRootContext {
            #key: CryptoKey | null = null
            #root: DecryptedRootFile | null = null
            #lockedSyncedRoot: LockedSyncedRoot | null = null
            #pendingRootIntegrations: Map<number, PendingRootIntegration> =
                new Map()

            get _root(): DecryptedRootFile | null {
                return this.#root
            }

            get _key(): CryptoKey | null {
                return this.#key
            }

            set _key(key: CryptoKey | null) {
                if (key === this.#key) {
                    return
                }
                const wasNull = this.#key === null
                this.#key = key
                if (wasNull) {
                    for (const [
                        priority,
                        { file, resolve, reject },
                    ] of this.#pendingRootIntegrations.entries()) {
                        this.#integrateRoot(file, priority).then(
                            resolve,
                            reject
                        )
                    }
                    this.#pendingRootIntegrations.clear()
                }
            }

            get _hasIdentity(): boolean {
                return this.#lockedSyncedRoot !== null
            }
            set _lockedSyncedRoot(lockedSyncedRoot: LockedSyncedRoot | null) {
                if (lockedSyncedRoot === this.#lockedSyncedRoot) {
                    return
                }
                const hadIdentity = this._hasIdentity
                this.#lockedSyncedRoot = lockedSyncedRoot

                if (hadIdentity !== this._hasIdentity) {
                    this._hasIdentityChanged()
                }
            }

            get _rootInfo(): MergeableItem<RootInfo> | null {
                return (
                    (this.#root &&
                        extractItems(
                            this.#root,
                            (item): item is MergeableItem<RootInfo> =>
                                item.payload.id === "rootInfo"
                        )[0]) ??
                    null
                )
            }

            async _rootAddressesChanged(): Promise<void> {
                await super._rootAddressesChanged()
                this._updateSyncManagers(ROOT_FILE_ID, this._rootAddresses)

                // Always reset our state when the last root address
                // is removed, so we don't have cases where the root exists
                // but isn't stored anywhere.
                if (this._rootAddresses.length === 0) {
                    await this._encryptRoot(true)
                }
            }

            async _dataRequested(
                fileId: string,
                address: StorageAddress
            ): Promise<boolean> {
                return (
                    (await super._dataRequested(fileId, address)) ||
                    (fileId === ROOT_FILE_ID &&
                        (await this._saveRootChanges(address)))
                )
            }

            async integrate(
                fileId: string,
                file: Uint8Array,
                priority: number
            ): Promise<boolean> {
                const handled = await super.integrate(fileId, file, priority)
                if (!handled && fileId === ROOT_FILE_ID) {
                    const task = await this._post(
                        `integrate(${fileId}, <file>, ${priority})`,
                        () => this.#integrateRoot(file, priority)
                    )
                    await task.promise
                    return true
                } else {
                    return handled
                }
            }

            _clearPendingRootIntegrations() {
                for (const pendingIntegration of this
                    .#pendingRootIntegrations) {
                    pendingIntegration[1].reject(new Error("Cancelled"))
                }
                this.#pendingRootIntegrations.clear()
            }

            #expectSyncedRoot(): LockedSyncedRoot {
                if (!this.#lockedSyncedRoot) {
                    throw new Error("Invalid state")
                }
                return this.#lockedSyncedRoot
            }

            async _saveRootChanges(address?: StorageAddress): Promise<boolean> {
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
                    this._saveChanges(ROOT_FILE_ID, file, address)
                }
                return true
            }

            async _updateRoot(
                newRoot: DecryptedRootFile | null,
                hint?: UpdateRootHint
            ) {
                // Do nothing if there are no changes
                if (areFilesEqual(this.#root, newRoot) && !hint?.forceSave) {
                    return
                }
                this.#root = newRoot

                this._rootChanged(hint)
                await this._saveRootChanges()
            }

            async #integrateRoot(
                file: Uint8Array,
                priority: number
            ): Promise<BackgroundTask<void>> {
                const {
                    version,
                    passwordSalt,
                    sentenceSalt,
                    keySalt,
                    encryptedData,
                } = decodeRoot(file)
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
                            canaryData: encryptedData,
                        }
                    }

                    // Data could not be integrated right away, so return a promise
                    // to wait on asynchronously
                    const res = {
                        promise: new Promise<void>((resolve, reject) => {
                            this.#pendingRootIntegrations.set(priority, {
                                file,
                                resolve,
                                reject,
                            })
                        }),
                    }
                    this.trace`#pendingRootIntegrations = ${[
                        ...this.#pendingRootIntegrations.entries(),
                    ]}`
                    return res
                } else {
                    const buffer = await decrypt(this.#key, encryptedData)
                    const downloadedRoot = decodeRootData(
                        new Uint8Array(buffer),
                        version
                    )
                    const mergedRoot = this.#root
                        ? mergeFiles(this.#root, downloadedRoot)
                        : downloadedRoot
                    await this._updateRoot(mergedRoot)

                    // Data was integrated immediately
                    return { promise: Promise.resolve() }
                }
            }

            async _recreateEncryptedRoot(
                masterPassword: string,
                secretSentence: string
            ): Promise<void> {
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
                    priority: 0,
                    passwordSalt,
                    sentenceSalt,
                    keySalt,
                    canaryData,
                }
                this._key = key
                this._superKey = superKey
            }

            async _decryptRoot(
                masterPassword: string,
                secretSentence: string | null
            ): Promise<void> {
                const { passwordSalt, sentenceSalt, keySalt, canaryData } =
                    this.#expectSyncedRoot()
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
                    setupKey = await combineKeys(
                        keyFromSentence,
                        keyFromPassword
                    )
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
                    if (
                        err instanceof DOMException &&
                        err.name === "OperationError"
                    ) {
                        throw new IncorrectPasswordError(
                            secretSentence !== null
                        )
                    } else {
                        throw err
                    }
                }

                if (secretSentence !== null) {
                    this._setupKey = setupKey
                }
                this._key = key
                this._superKey = superKey
            }

            async _encryptRoot(unenroll: boolean): Promise<void> {
                if (!this._key && (!unenroll || !this._setupKey)) {
                    return
                }
                this._key = null
                this._superKey = null
                this._lockedSyncedRoot = null
                this._clearPendingRootIntegrations()
                await this._updateRoot(null)

                if (unenroll) {
                    this._setupKey = null
                }

                // Re-download the encrypted root file, since we don't
                // retain that after we unlock it.
                this._refetchData(ROOT_FILE_ID)
            }

            async _patchRoot(
                f: (root: DecryptedRootFile) => DecryptedRootFile,
                hint?: UpdateRootHint
            ): Promise<void> {
                if (!this._root) {
                    throw new Error("Locked - cannot update")
                }
                await this._updateRoot(f(this._root), hint)
            }

            _rootChanged(_hint?: UpdateRootHint) {}
            _hasIdentityChanged() {}

            static _decorators = [
                abstractMethod("_rootChanged"),
                abstractMethod("_hasIdentityChanged"),
            ] as const
        }
    )
)
