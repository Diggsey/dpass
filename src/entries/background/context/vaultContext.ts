import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import {
    decodeVaultData,
    DecryptedVaultFile,
    encodeVaultData,
    VaultFileItem,
    VaultInfoItem,
} from "../serialize/vaultData"
import { IRootContext, UpdateRootHint } from "./rootContext"
import { ISyncManagerContext } from "./syncManagerContext"
import {
    decrypt,
    decryptKey,
    deriveKeyFromSuperKey,
    encrypt,
    encryptKey,
    exportKey,
    generateSalt,
    generateSuperKey,
    importKey,
    KeyApplication,
} from "../crypto"
import { decodeVault, encodeVault } from "../serialize/vault"
import {
    areFilesEqual,
    extractItems,
    itemCreator,
    itemPatcher,
    MergeableItem,
    mergeFiles,
    newFile,
} from "../serialize/merge"
import { Vault } from "../serialize/rootData"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { StorageAddress } from "~/entries/shared/privileged/state"

export type VaultState = {
    keySalt: Uint8Array | null
    vault: DecryptedVaultFile | null
}
export interface IVaultContext {
    get _vaults(): Map<string, VaultState>
    get _defaultVaultId(): string | null

    _updateVault(
        vaultId: string,
        newVault: DecryptedVaultFile,
        keySalt?: Uint8Array
    ): Promise<void>
    _patchVault(
        vaultId: string,
        f: (root: DecryptedVaultFile) => DecryptedVaultFile
    ): Promise<void>
    _deriveVaultSuperKey(vaultId: string): Promise<CryptoKey>

    createVault(name: string, copyStorage: boolean): Promise<string>
    updateVaultName(vaultId: string, name: string): Promise<void>
    removeVault(vaultId: string): Promise<void>
    editVaultStorageAddresses(
        vaultId: string,
        f: (addresses: readonly StorageAddress[]) => readonly StorageAddress[]
    ): Promise<void>
    setVaultAsDefault(vaultId: string): Promise<void>

    // Must be implemented
    _vaultChanged(vaultId: string): void
}

// Handles loading and updating the setup key
export const VaultContext = mixin<
    IVaultContext,
    Actor &
        IRootContext &
        ISyncManagerContext &
        ISuperKeyContext &
        IRootAddressesContext
>((Base) =>
    Decorated(
        class VaultContext extends Base implements IVaultContext {
            #vaults: Map<string, VaultState> = new Map()
            #defaultVaultId: string | null = null

            get _vaults(): Map<string, VaultState> {
                return this.#vaults
            }

            get _defaultVaultId(): string | null {
                return this.#defaultVaultId
            }

            async _dataRequested(
                fileId: string,
                addressKey: string
            ): Promise<boolean> {
                return (
                    (await super._dataRequested(fileId, addressKey)) ||
                    (await this.#saveVaultChanges(fileId, addressKey))
                )
            }

            async integrate(
                fileId: string,
                file: Uint8Array,
                priority: number
            ): Promise<boolean> {
                return (
                    (await super.integrate(fileId, file, priority)) ||
                    (await this.#integrateVault(fileId, file))
                )
            }

            _rootChanged(hint?: UpdateRootHint): void {
                super._rootChanged(hint)

                const newVaults = new Map<string, VaultState>()
                let newDefaultVaultId = null
                let newDefaultVaultTs = -Infinity
                if (this._root) {
                    // Connect to new vault addresses
                    for (const item of this._root.items) {
                        if (item.payload?.id === "vault") {
                            const { fileId, addresses, setAsDefaultOn } =
                                item.payload
                            if (
                                setAsDefaultOn !== undefined &&
                                setAsDefaultOn > newDefaultVaultTs
                            ) {
                                newDefaultVaultId = fileId
                                newDefaultVaultTs = setAsDefaultOn
                            }

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
                this.#defaultVaultId = newDefaultVaultId
                // Disconnect from old vault addresses
                for (const vaultId of this.#vaults.keys()) {
                    this._updateSyncManagers(vaultId, [])
                }
                this.#vaults = newVaults
            }

            async #saveVaultChanges(
                vaultId: string,
                addressKey?: string
            ): Promise<boolean> {
                const vaultDesc = this.#getVaultDesc(vaultId)
                const vaultState = this.#vaults.get(vaultId)
                if (!vaultDesc || !vaultState?.vault || !vaultState.keySalt) {
                    return false
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

                return true
            }

            async _updateVault(
                vaultId: string,
                newVault: DecryptedVaultFile,
                keySalt?: Uint8Array
            ): Promise<void> {
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
                this._vaultChanged(vaultId)
            }

            _patchVault(
                vaultId: string,
                f: (root: DecryptedVaultFile) => DecryptedVaultFile
            ): Promise<void> {
                return this._post(`patchVault(${vaultId}, ...)`, async () => {
                    const vaultState = this._vaults.get(vaultId)
                    if (!vaultState?.vault) {
                        throw new Error("No such vault - cannot update")
                    }
                    await this._updateVault(vaultId, f(vaultState.vault))
                })
            }

            #getVaultDesc(vaultId: string): MergeableItem<Vault> | undefined {
                if (!this._root) {
                    return
                }
                return extractItems(
                    this._root,
                    (item): item is MergeableItem<Vault> =>
                        item.payload.id === "vault" &&
                        item.payload.fileId === vaultId
                )[0]
            }

            async #integrateVault(
                fileId: string,
                file: Uint8Array
            ): Promise<boolean> {
                const vaultDesc = this.#getVaultDesc(fileId)
                if (!vaultDesc) {
                    return false
                }
                const { version, keySalt, encryptedData } = decodeVault(file)
                const vaultKey = await importKey(vaultDesc.payload.vaultKey)
                const buffer = await decrypt(vaultKey, encryptedData)
                const downloadedVault = decodeVaultData(
                    new Uint8Array(buffer),
                    version
                )
                await this._post(`mergeAndUpdateVault(${fileId})`, async () => {
                    const vaultState = this.#vaults.get(fileId)
                    const mergedVault = vaultState?.vault
                        ? mergeFiles(vaultState.vault, downloadedVault)
                        : downloadedVault
                    await this._updateVault(fileId, mergedVault, keySalt)
                })

                return true
            }

            async _deriveVaultSuperKey(vaultId: string): Promise<CryptoKey> {
                const superKey = await this._requireSuperKey()
                const vaultDesc = this.#getVaultDesc(vaultId)
                if (!vaultDesc) {
                    throw new Error("Vault not found")
                }
                const { personalVaultSalt, encryptedVaultSuperKey } =
                    vaultDesc.payload
                const personalVaultKey = await deriveKeyFromSuperKey(
                    superKey,
                    personalVaultSalt,
                    KeyApplication.personalVaultKey
                )
                return await decryptKey(
                    personalVaultKey,
                    encryptedVaultSuperKey
                )
            }

            updateVaultName(vaultId: string, name: string): Promise<void> {
                return this._patchVault(
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
            async createVault(
                name: string,
                copyStorage: boolean
            ): Promise<string> {
                const superKey = await this._requireSuperKey()
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
                const setAsDefaultOn =
                    this._defaultVaultId !== null ? undefined : Date.now()

                const addresses: readonly StorageAddress[] = copyStorage
                    ? this._rootAddresses
                    : [
                          {
                              id: "local",
                              folderName: "default",
                          },
                      ]

                await this._patchRoot(
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
            async removeVault(vaultId: string): Promise<void> {
                await this._patchRoot(
                    itemPatcher((item, _uuid) =>
                        item?.id === "vault" && item.fileId === vaultId
                            ? null
                            : item
                    )
                )
            }
            async editVaultStorageAddresses(
                vaultId: string,
                f: (
                    addresses: readonly StorageAddress[]
                ) => readonly StorageAddress[]
            ): Promise<void> {
                await this._patchRoot(
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
            async setVaultAsDefault(vaultId: string): Promise<void> {
                const setAsDefaultOn = Date.now()
                await this._patchRoot(
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

            _vaultChanged(_vaultId: string) {}

            static _decorators = [abstractMethod("_vaultChanged")] as const
        }
    )
)
