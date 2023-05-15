import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import {
    decodeVaultData,
    DecryptedVaultFile,
    encodeVaultData,
    VaultInfoItem,
} from "../serialize/vaultData"
import { IRootContext, UpdateRootHint } from "./rootContext"
import { ISyncManagerContext } from "./syncManagerContext"
import {
    decrypt,
    decryptKey,
    deriveKeyFromSuperKey,
    encrypt,
    importKey,
    KeyApplication,
} from "../../shared/crypto"
import { decodeVault, encodeVault } from "../serialize/vault"
import {
    areFilesEqual,
    extractItems,
    MergeableItem,
    mergeFiles,
} from "../serialize/merge"
import { Vault } from "../serialize/rootData"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { StorageAddress } from "~/entries/shared/privileged/state"

class MissingVaultError extends Error {
    constructor() {
        super("Vault not found")
    }
}

export type VaultState = {
    keySalt: Uint8Array | null
    vault: DecryptedVaultFile | null
}
export interface IVaultContext {
    get _vaults(): Map<string, VaultState>
    get _defaultVaultId(): string | null

    _backupVault(vaultId: string): Promise<Uint8Array>
    _integrateVault(fileId: string, file: Uint8Array): Promise<void>
    _patchVault(
        vaultId: string,
        f: (root: DecryptedVaultFile) => DecryptedVaultFile
    ): Promise<void>
    _deriveVaultSuperKey(vaultId: string): Promise<CryptoKey>
    _getVault(vaultId: string): DecryptedVaultFile
    _getVaultInfo(vaultId: string): MergeableItem<VaultInfoItem> | null

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
                address: StorageAddress
            ): Promise<boolean> {
                return (
                    (await super._dataRequested(fileId, address)) ||
                    (await this.#saveVaultChanges(fileId, address))
                )
            }

            async integrate(
                fileId: string,
                file: Uint8Array,
                priority: number
            ): Promise<boolean> {
                const handled = await super.integrate(fileId, file, priority)
                if (!handled) {
                    await this._post(
                        `integrate(${fileId}, <file>, ${priority})`,
                        () => this._integrateVault(fileId, file)
                    )
                    return true
                }
                return handled
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

            async _backupVault(vaultId: string): Promise<Uint8Array> {
                const vaultDesc = this.#getVaultDesc(vaultId)
                const vaultState = this.#vaults.get(vaultId)
                if (!vaultDesc || !vaultState?.vault || !vaultState.keySalt) {
                    throw new MissingVaultError()
                }
                // Upload vault changes
                const encodedData = encodeVaultData(vaultState.vault)
                const vaultKey = await importKey(vaultDesc.payload.vaultKey)
                const encryptedData = await encrypt(vaultKey, encodedData)
                return encodeVault({
                    keySalt: vaultState.keySalt,
                    encryptedData: new Uint8Array(encryptedData),
                })
            }

            async #saveVaultChanges(
                vaultId: string,
                address?: StorageAddress
            ): Promise<boolean> {
                try {
                    const file = await this._backupVault(vaultId)
                    this._saveChanges(vaultId, file, address)
                    return true
                } catch (ex) {
                    if (!(ex instanceof MissingVaultError)) {
                        throw ex
                    }
                }
                return false
            }

            async #updateVault(
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

            async _patchVault(
                vaultId: string,
                f: (root: DecryptedVaultFile) => DecryptedVaultFile
            ): Promise<void> {
                const vault = this._getVault(vaultId)
                await this.#updateVault(vaultId, f(vault))
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

            async _integrateVault(
                fileId: string,
                file: Uint8Array
            ): Promise<void> {
                const vaultDesc = this.#getVaultDesc(fileId)
                if (!vaultDesc) {
                    return
                }
                const { version, keySalt, encryptedData } = decodeVault(file)
                const vaultKey = await importKey(vaultDesc.payload.vaultKey)
                const buffer = await decrypt(vaultKey, encryptedData)
                const downloadedVault = decodeVaultData(
                    new Uint8Array(buffer),
                    version
                )
                const vaultState = this.#vaults.get(fileId)
                const mergedVault = vaultState?.vault
                    ? mergeFiles(vaultState.vault, downloadedVault)
                    : downloadedVault
                await this.#updateVault(fileId, mergedVault, keySalt)
            }

            async _deriveVaultSuperKey(vaultId: string): Promise<CryptoKey> {
                const superKey = await this._requireSuperKey()
                const vaultDesc = this.#getVaultDesc(vaultId)
                if (!vaultDesc) {
                    throw new MissingVaultError()
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

            _getVault(vaultId: string): DecryptedVaultFile {
                const vaultState = this.#vaults.get(vaultId)
                if (!vaultState?.vault) {
                    throw new MissingVaultError()
                }
                return vaultState.vault
            }

            _getVaultInfo(
                vaultId: string
            ): MergeableItem<VaultInfoItem> | null {
                const vault = this.#vaults.get(vaultId)?.vault
                return (
                    (vault &&
                        extractItems(
                            vault,
                            (item): item is MergeableItem<VaultInfoItem> =>
                                item.payload.id === "vaultInfo"
                        )[0]) ??
                    null
                )
            }

            _vaultChanged(_vaultId: string) {}

            static _decorators = [abstractMethod("_vaultChanged")] as const
        }
    )
)
