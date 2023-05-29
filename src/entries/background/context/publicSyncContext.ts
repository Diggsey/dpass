import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IRootContext, ROOT_FILE_ID } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import { ISyncManagerContext } from "./syncManagerContext"

export interface IPublicBackupContext {
    sync(): void
}

// Public methods for interacting with vault items
export const PublicSyncContext = mixin<
    IPublicBackupContext,
    Actor & IRootContext & IVaultContext & ISyncManagerContext
>(
    (Base) =>
        class PublicSyncContext extends Base implements IPublicBackupContext {
            sync() {
                for (const vaultId of this._vaults.keys()) {
                    this._refetchData(vaultId)
                }
                this._refetchData(ROOT_FILE_ID)
            }
        }
)
