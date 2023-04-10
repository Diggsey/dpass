import { Actor } from "./actor"
import { RootFileItem } from "./serialize/rootData"
import { NormalItem, VaultItemData } from "./serialize/vaultData"
import { IIntegrator } from "./sync/manager"
import {
    extractItems,
    itemCreator,
    itemPatcher,
    MergeableItem,
} from "./serialize/merge"
import {
    decrypt,
    deriveKeyFromSuperKey,
    encrypt,
    generateSalt,
    KeyApplication,
} from "./crypto"
import * as msgpack from "@msgpack/msgpack"
import { VaultItemPayload } from "../shared/state"
import { ItemDetails } from "../shared/messages/vault"
import { SetupKeyContext } from "./context/setupKeyContext"
import { SuperKeyContext } from "./context/superKeyContext"
import { SyncManagerContext } from "./context/syncManagerContext"
import { RootAddressesContext } from "./context/rootAddressesContext"
import { StatePublisherContext } from "./context/statePublisherContext"
import { ROOT_FILE_ID, RootContext } from "./context/rootContext"
import { VaultContext } from "./context/vaultContext"

class SecureContext
    extends StatePublisherContext(
        VaultContext(
            RootContext(
                RootAddressesContext(
                    SyncManagerContext(SuperKeyContext(SetupKeyContext(Actor)))
                )
            )
        )
    )
    implements IIntegrator
{
    async _rootAddressesChanged(): Promise<void> {
        await super._rootAddressesChanged()
        if (this._rootAddresses.length === 0) {
            await this.#lockInner(true)
        }
    }

    async #lockInner(unenroll: boolean) {
        this._key = null
        this._superKey = null
        await this._clearRoot()

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
            if (this._key === null && (!unenroll || !this._setupKey)) {
                return
            }
            await this.#lockInner(unenroll)
        })
    }
    unlock(
        masterPassword: string,
        secretSentence: string | null
    ): Promise<void> {
        return this._post("unlock()", () =>
            this._decryptRoot(masterPassword, secretSentence)
        )
    }
    createRoot(
        name: string,
        masterPassword: string,
        secretSentence: string
    ): Promise<void> {
        return this._post("createRoot(<redacted>)", async () => {
            if (this._lockedSyncedRoot) {
                throw new Error("Root already exists")
            }

            const currentTs = Date.now()
            await this._recreateEncryptedRoot(masterPassword, secretSentence)
            await this._updateRoot({
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
                await this._decryptRoot(oldPassword, null)

                const oldSentence = this._rootInfo?.payload.secretSentence
                if (oldSentence === undefined) {
                    throw new Error("Secret sentence not set")
                }

                await this._recreateEncryptedRoot(
                    newPassword ?? oldPassword,
                    newSentence ?? oldSentence
                )

                if (newSentence !== null && this._root !== null) {
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
                    await this._updateRoot(rootInfoPatcher(this._root), {
                        forceSave: true,
                    })
                } else {
                    // Save changes to storage
                    await this._saveRootChanges()
                }
            }
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
    async deleteVaultItem(vaultId: string, itemId: string) {
        await this._patchVault(
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
        await this._patchVault(
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
}

export const SECURE_CONTEXT = new SecureContext()
