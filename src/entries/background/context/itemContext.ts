import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IVaultContext } from "./vaultContext"
import { IHistoryContext } from "./historyContext"
import { NormalItem, VaultItemData } from "../serialize/vaultData"
import {
    MergeableItem,
    extractItems,
    itemCreator,
    itemPatcher,
    itemsCreator,
} from "../serialize/merge"
import {
    KeyApplication,
    decrypt,
    deriveKeyFromSuperKey,
    encrypt,
    generateSalt,
} from "../../shared/crypto"
import { VaultItemField, VaultItemPayload } from "~/entries/shared/state"
import * as msgpack from "@msgpack/msgpack"
import { HistoryEntry } from "../serialize/rootData"
import { ItemDetails } from "~/entries/shared/messages/vault"

export interface IItemContext {
    _createVaultItem(
        overrideVaultId: string | undefined,
        details: ItemDetails
    ): Promise<string>
    _deleteVaultItem(vaultId: string, itemId: string): Promise<void>
    _updateVaultItem(
        vaultId: string,
        itemId: string,
        details: ItemDetails
    ): Promise<void>
    _getVaultItem(vaultId: string, itemId: string): NormalItem
    _getVaultItemAndDecryptedPayload(
        vaultId: string,
        itemId: string
    ): Promise<[NormalItem, VaultItemPayload]>
    _exportVaultItems(
        vaultId: string
    ): Promise<[NormalItem, VaultItemPayload][]>
    _importVaultItems(
        overrideVaultId: string | undefined,
        detailsList: ItemDetails[]
    ): Promise<void>
}

// Handles loading and updating the setup key
export const ItemContext = mixin<
    IItemContext,
    Actor & IVaultContext & IHistoryContext
>(
    (Base) =>
        class ItemContext extends Base implements IItemContext {
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
            async #deriveVaultItemKeyWithVaultKey(
                vaultSuperKey: CryptoKey,
                itemSalt: Uint8Array
            ): Promise<CryptoKey> {
                return await deriveKeyFromSuperKey(
                    vaultSuperKey,
                    itemSalt,
                    KeyApplication.itemKey
                )
            }
            async #deriveVaultItemKey(
                vaultId: string,
                itemSalt: Uint8Array
            ): Promise<CryptoKey> {
                const vaultSuperKey = await this._deriveVaultSuperKey(vaultId)
                return await this.#deriveVaultItemKeyWithVaultKey(
                    vaultSuperKey,
                    itemSalt
                )
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
            _getVaultItem(vaultId: string, itemId: string): NormalItem {
                const vault = this._getVault(vaultId)
                const item = extractItems(
                    vault,
                    (item): item is MergeableItem<NormalItem> =>
                        item.payload.id === "normal" && item.uuid === itemId
                )[0]
                if (!item) {
                    throw new Error("No such item")
                }
                return item.payload
            }

            async _getVaultItemAndDecryptedPayload(
                vaultId: string,
                itemId: string
            ): Promise<[NormalItem, VaultItemPayload]> {
                const item = this._getVaultItem(vaultId, itemId)
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
            async _exportVaultItems(
                vaultId: string
            ): Promise<[NormalItem, VaultItemPayload][]> {
                const vault = this._getVault(vaultId)
                const items = extractItems(
                    vault,
                    (item): item is MergeableItem<NormalItem> =>
                        item.payload.id === "normal"
                )
                const results: [NormalItem, VaultItemPayload][] = []
                let vaultSuperKey = null
                for (const { payload: item } of items) {
                    if (!item.data.encrypted) {
                        results.push([item, item.data.payload])
                    } else {
                        if (vaultSuperKey === null) {
                            vaultSuperKey = await this._deriveVaultSuperKey(
                                vaultId
                            )
                        }
                        const itemKey =
                            await this.#deriveVaultItemKeyWithVaultKey(
                                vaultSuperKey,
                                item.data.salt
                            )
                        const buffer = await decrypt(itemKey, item.data.payload)
                        results.push([
                            item,
                            msgpack.decode(buffer) as VaultItemPayload,
                        ])
                    }
                }
                return results
            }
            async _importVaultItems(
                overrideVaultId: string | undefined,
                detailsList: ItemDetails[]
            ): Promise<void> {
                const vaultId = overrideVaultId ?? this._defaultVaultId
                if (vaultId === null) {
                    throw new Error("No default vault")
                }
                const items: NormalItem[] = []
                for (const details of detailsList) {
                    const { payload, encrypted, ...rest } = details
                    const data = await this.#buildItemDataFromPayload(
                        vaultId,
                        payload ?? { fields: [] },
                        encrypted
                    )
                    items.push({
                        id: "normal",
                        ...rest,
                        data,
                    })
                }
                await this._patchVault(vaultId, itemsCreator(items))
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
            async _createVaultItem(
                overrideVaultId: string | undefined,
                details: ItemDetails
            ): Promise<string> {
                const vaultId = overrideVaultId ?? this._defaultVaultId
                if (vaultId === null) {
                    throw new Error("No default vault")
                }
                const itemId = crypto.randomUUID()
                const { payload, encrypted, ...rest } = details
                const data = await this.#buildItemDataFromPayload(
                    vaultId,
                    payload ?? { fields: [] },
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
            async _deleteVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<void> {
                const [oldItem, oldPayload] =
                    await this._getVaultItemAndDecryptedPayload(vaultId, itemId)
                await this.#recordOldValues(
                    oldItem.origins,
                    oldPayload.fields,
                    []
                )
                await this.#patchVaultItem(vaultId, itemId, () => null)
            }
            async _updateVaultItem(
                vaultId: string,
                itemId: string,
                details: ItemDetails
            ): Promise<void> {
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
                        await this._getVaultItemAndDecryptedPayload(
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
        }
)
