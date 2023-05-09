import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { NormalItem, VaultItemData } from "../serialize/vaultData"
import {
    MergeableItem,
    extractItems,
    itemCreator,
    itemPatcher,
} from "../serialize/merge"
import { IRootContext } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import {
    KeyApplication,
    decrypt,
    deriveKeyFromSuperKey,
    encrypt,
    generateSalt,
} from "../crypto"
import { VaultItemField, VaultItemPayload } from "~/entries/shared/state"
import * as msgpack from "@msgpack/msgpack"
import { ItemDetails } from "~/entries/shared/messages/vault"
import { IHistoryContext } from "./historyContext"
import { HistoryEntry } from "../serialize/rootData"

export interface IPublicItemContext {
    createVaultItem(
        vaultId: string | undefined,
        details: ItemDetails
    ): Promise<string>
    deleteVaultItem(vaultId: string, itemId: string): Promise<void>
    getVaultItem(vaultId: string, itemId: string): Promise<NormalItem>
    updateVaultItem(
        vaultId: string,
        itemId: string,
        details: ItemDetails
    ): Promise<void>
    decryptVaultItem(vaultId: string, itemId: string): Promise<VaultItemPayload>
}

// Public methods for interacting with vault items
export const PublicItemContext = mixin<
    IPublicItemContext,
    Actor &
        IRootContext &
        IVaultContext &
        ISuperKeyContext &
        IRootAddressesContext &
        IHistoryContext
>(
    (Base) =>
        class PublicItemContext extends Base implements IPublicItemContext {
            #patchVaultItem(
                vaultId: string,
                itemId: string,
                f: (vaultInfo: NormalItem) => NormalItem | null
            ): Promise<void> {
                return this._patchVault(
                    vaultId,
                    itemPatcher((payload, uuid) => {
                        if (uuid === itemId && payload?.id === "normal") {
                            return f(payload)
                        }
                        return payload
                    })
                )
            }
            async #deriveVaultItemKey(
                vaultId: string,
                itemSalt: Uint8Array
            ): Promise<CryptoKey> {
                const vaultSuperKey = await this._deriveVaultSuperKey(vaultId)
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
                    const itemKey = await this.#deriveVaultItemKey(
                        vaultId,
                        salt
                    )
                    return {
                        encrypted: true,
                        salt,
                        payload: await encrypt(
                            itemKey,
                            msgpack.encode(payload)
                        ),
                    }
                } else {
                    return {
                        encrypted: false,
                        payload,
                    }
                }
            }
            #getVaultItem(vaultId: string, itemId: string): NormalItem {
                const vaultState = this._vaults.get(vaultId)
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

            async #getVaultItemAndDecryptedPayload(
                vaultId: string,
                itemId: string
            ): Promise<[NormalItem, VaultItemPayload]> {
                const item = this.#getVaultItem(vaultId, itemId)
                if (!item.data.encrypted) {
                    return [item, item.data.payload]
                }
                const itemKey = await this.#deriveVaultItemKey(
                    vaultId,
                    item.data.salt
                )
                const buffer = await decrypt(itemKey, item.data.payload)
                return [item, msgpack.decode(buffer) as VaultItemPayload]
            }
            async #recordOldValues(
                origins: string[],
                oldFields: VaultItemField[],
                newFields: VaultItemField[]
            ): Promise<void> {
                const historyEntries: HistoryEntry[] = []
                for (const oldField of oldFields) {
                    const newField = newFields.find(
                        (f) => f.uuid === oldField.uuid
                    )
                    if (!newField || oldField.value !== newField.value) {
                        historyEntries.push({
                            id: "historyEntry",
                            type: newField ? "changed" : "deleted",
                            origins,
                            name: oldField.name,
                            autofillMode: oldField.autofillMode,
                            value: oldField.value,
                        })
                    }
                }
                await this._recordHistory(historyEntries)
            }
            async createVaultItem(
                overrideVaultId: string | undefined,
                details: ItemDetails
            ): Promise<string> {
                return this._post(
                    `createVaultItem(${overrideVaultId}, ${details})`,
                    async () => {
                        const vaultId = overrideVaultId ?? this._defaultVaultId
                        if (vaultId === null) {
                            throw new Error("No default vault")
                        }
                        const itemId = crypto.randomUUID()
                        const { payload, encrypted, ...rest } = details
                        const data = await this.#buildItemDataFromPayload(
                            vaultId,
                            payload || { fields: [] },
                            encrypted
                        )
                        await this._patchVault(
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
                )
            }
            async deleteVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<void> {
                return this._post(
                    `deleteVaultItem(${vaultId}, ${itemId})`,
                    async () => {
                        const [oldItem, oldPayload] =
                            await this.#getVaultItemAndDecryptedPayload(
                                vaultId,
                                itemId
                            )
                        await this.#recordOldValues(
                            oldItem.origins,
                            oldPayload.fields,
                            []
                        )
                        await this.#patchVaultItem(vaultId, itemId, () => null)
                    }
                )
            }
            async updateVaultItem(
                vaultId: string,
                itemId: string,
                details: ItemDetails
            ): Promise<void> {
                return this._post(
                    `updateVaultItem(${vaultId}, ${itemId}, ${details})`,
                    async () => {
                        const { payload, encrypted, ...rest } = details
                        const data =
                            payload &&
                            (await this.#buildItemDataFromPayload(
                                vaultId,
                                payload,
                                encrypted
                            ))
                        if (payload) {
                            const [oldItem, oldPayload] =
                                await this.#getVaultItemAndDecryptedPayload(
                                    vaultId,
                                    itemId
                                )
                            await this.#recordOldValues(
                                oldItem.origins,
                                oldPayload.fields,
                                payload?.fields
                            )
                        }
                        await this.#patchVaultItem(vaultId, itemId, (item) => ({
                            id: "normal",
                            ...rest,
                            data: data || item.data,
                        }))
                    }
                )
            }
            async getVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<NormalItem> {
                return this._post(
                    `getVaultItem(${vaultId}, ${itemId})`,
                    async () => {
                        return this.#getVaultItem(vaultId, itemId)
                    }
                )
            }
            async decryptVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<VaultItemPayload> {
                return this._post(
                    `decryptVaultItem(${vaultId}, ${itemId})`,
                    async () => {
                        const [_item, payload] =
                            await this.#getVaultItemAndDecryptedPayload(
                                vaultId,
                                itemId
                            )
                        return payload
                    }
                )
            }
        }
)
