import { mixin } from "~/entries/shared/mixin"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { Actor } from "../actor"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { Vault } from "../serialize/rootData"
import {
    DecryptedVaultFile,
    VaultFileItem,
    VaultInfoItem,
} from "../serialize/vaultData"
import { itemCreator, itemPatcher, newFile } from "../serialize/merge"
import { IRootContext, UpdateRootHint } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import {
    KeyApplication,
    deriveKeyFromSuperKey,
    encryptKey,
    exportKey,
    generateSalt,
    generateSuperKey,
} from "../crypto"

export interface IPublicVaultContext {
    createVault(name: string, copyStorage: boolean): Promise<string>
    updateVaultName(vaultId: string, name: string): Promise<void>
    removeVault(vaultId: string): Promise<void>
    editVaultStorageAddresses(
        vaultId: string,
        f: (addresses: readonly StorageAddress[]) => readonly StorageAddress[]
    ): Promise<void>
    setVaultAsDefault(vaultId: string): Promise<void>
}

// Publishes changes to the context
export const PublicVaultContext = mixin<
    IPublicVaultContext,
    Actor &
        IRootContext &
        IVaultContext &
        ISuperKeyContext &
        IRootAddressesContext
>(
    (Base) =>
        class PublicVaultContext extends Base implements IPublicVaultContext {
            #patchVaultDesc(
                vaultId: string,
                f: (vaultDesc: Vault) => Vault | null,
                hint?: UpdateRootHint
            ): Promise<void> {
                return this._patchRoot(
                    itemPatcher((payload) => {
                        if (
                            payload?.id === "vault" &&
                            payload.fileId === vaultId
                        ) {
                            return f(payload)
                        }
                        return payload
                    }),
                    hint
                )
            }
            #patchVaultInfo(
                vaultId: string,
                f: (vaultInfo: VaultInfoItem) => VaultInfoItem
            ): Promise<void> {
                return this._patchVault(
                    vaultId,
                    itemPatcher((payload) => {
                        if (payload?.id === "vaultInfo") {
                            return f(payload)
                        }
                        return payload
                    })
                )
            }

            updateVaultName(vaultId: string, name: string): Promise<void> {
                return this._post(`updateVaultName(${vaultId}, ${name})`, () =>
                    this.#patchVaultInfo(vaultId, (vaultInfo) => ({
                        ...vaultInfo,
                        name,
                    }))
                )
            }
            createVault(name: string, copyStorage: boolean): Promise<string> {
                return this._postWithRetryIfLocked(
                    `createVault(${name}, ${copyStorage})`,
                    async () => {
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
                            this._defaultVaultId !== null
                                ? undefined
                                : Date.now()

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
                )
            }
            removeVault(vaultId: string): Promise<void> {
                return this._post(`removeVault(${vaultId})`, () =>
                    this.#patchVaultDesc(vaultId, () => null)
                )
            }
            async editVaultStorageAddresses(
                vaultId: string,
                f: (
                    addresses: readonly StorageAddress[]
                ) => readonly StorageAddress[]
            ): Promise<void> {
                return this._post(
                    `editVaultStorageAddresses(${vaultId}, ${f})`,
                    () =>
                        this.#patchVaultDesc(vaultId, (vaultDesc) => ({
                            ...vaultDesc,
                            addresses: f(vaultDesc.addresses),
                        }))
                )
            }
            async setVaultAsDefault(vaultId: string): Promise<void> {
                const setAsDefaultOn = Date.now()
                return this._post(`setVaultAsDefault(${vaultId})`, () =>
                    this.#patchVaultDesc(vaultId, (vaultDesc) => ({
                        ...vaultDesc,
                        setAsDefaultOn,
                    }))
                )
            }
        }
)
