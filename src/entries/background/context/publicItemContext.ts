import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { ISuperKeyContext } from "./superKeyContext"
import { IRootAddressesContext } from "./rootAddressesContext"
import { NormalItem } from "../serialize/vaultData"
import { IRootContext } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import { VaultItemPayload } from "~/entries/shared/state"
import { ItemDetails } from "~/entries/shared/messages/vault"
import { IHistoryContext } from "./historyContext"
import { IItemContext } from "./itemContext"

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
        IItemContext &
        ISuperKeyContext &
        IRootAddressesContext &
        IHistoryContext
>(
    (Base) =>
        class PublicItemContext extends Base implements IPublicItemContext {
            async createVaultItem(
                overrideVaultId: string | undefined,
                details: ItemDetails
            ): Promise<string> {
                return this._post(
                    `createVaultItem(${overrideVaultId}, ${details})`,
                    () => this._createVaultItem(overrideVaultId, details)
                )
            }
            async deleteVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<void> {
                return this._post(
                    `deleteVaultItem(${vaultId}, ${itemId})`,
                    () => this._deleteVaultItem(vaultId, itemId)
                )
            }
            async updateVaultItem(
                vaultId: string,
                itemId: string,
                details: ItemDetails
            ): Promise<void> {
                return this._post(
                    `updateVaultItem(${vaultId}, ${itemId}, ${details})`,
                    () => this._updateVaultItem(vaultId, itemId, details)
                )
            }
            async getVaultItem(
                vaultId: string,
                itemId: string
            ): Promise<NormalItem> {
                return this._post(
                    `getVaultItem(${vaultId}, ${itemId})`,
                    async () => {
                        return this._getVaultItem(vaultId, itemId)
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
                            await this._getVaultItemAndDecryptedPayload(
                                vaultId,
                                itemId
                            )
                        return payload
                    }
                )
            }
        }
)
