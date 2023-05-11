import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IRootContext, ROOT_FILE_ID } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import JSZip from "jszip"
import { DOWNLOAD_MANAGER } from "../download"
import { sanitizeNameForExport } from "~/entries/shared"

export interface IPublicBackupContext {
    backup(): Promise<void>
    restore(url: string): Promise<void>
}

// Public methods for interacting with vault items
export const PublicBackupContext = mixin<
    IPublicBackupContext,
    Actor & IRootContext & IVaultContext
>(
    (Base) =>
        class PublicBackupContext extends Base implements IPublicBackupContext {
            async backup(): Promise<void> {
                const zipFile = new JSZip()
                let filename = ""
                await this._post("backup()", async () => {
                    const rootFile = await this._backupRoot()
                    zipFile.file(ROOT_FILE_ID, rootFile)
                    for (const vaultId of this._vaults.keys()) {
                        const vaultFile = await this._backupVault(vaultId)
                        zipFile.file(vaultId, vaultFile)
                    }
                    const dateStr = new Date().toISOString().slice(0, 10)
                    const sanitizedName = sanitizeNameForExport(
                        this._rootInfo?.payload.name
                    )
                    filename = `dpass-${sanitizedName}-${dateStr}.zip`
                })
                const blob = await zipFile.generateAsync({
                    type: "blob",
                    compression: "DEFLATE",
                    platform: "UNIX",
                })
                DOWNLOAD_MANAGER.beginDownload(filename, blob)
            }
            async restore(url: string): Promise<void> {
                this.trace`restore(${url})`

                const resp = await fetch(url)
                const zipFile = new JSZip()
                await zipFile.loadAsync(resp.arrayBuffer())
                const rootFile = await zipFile
                    .file(ROOT_FILE_ID)
                    ?.async("uint8array")

                if (rootFile) {
                    const backgroundTask = await this._post(
                        `_integrateRoot(<file>, 0)`,
                        () => this._integrateRoot(rootFile, 0)
                    )
                    await backgroundTask.promise
                }
                for (const [vaultId, file] of Object.entries(zipFile.files)) {
                    if (vaultId !== ROOT_FILE_ID) {
                        const vaultFile = await file.async("uint8array")
                        await this._post(
                            `_integrateVault(${vaultId}, <file>)`,
                            () => this._integrateVault(vaultId, vaultFile)
                        )
                    }
                }
            }
        }
)
