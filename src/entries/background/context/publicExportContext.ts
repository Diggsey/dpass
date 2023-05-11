import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IRootContext } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import { DOWNLOAD_MANAGER } from "../download"
import { IItemContext } from "./itemContext"
import { VaultItemPayload } from "~/entries/shared/state"
import { PresetAutofillValue } from "~/entries/shared/autofill"
import { sanitizeNameForExport } from "~/entries/shared"
import Papa from "papaparse"

export interface IPublicExportContext {
    exportVaultItems(vaultId: string): Promise<void>
    importVaultItems(vaultId: string, url: string): Promise<void>
}

type CsvValue = null | boolean | number | string
type CsvRow = CsvValue[]

const DEFAULT_FIELDS = ["username", "email", "password", "note"] as const

// Public methods for interacting with vault items
export const PublicExportContext = mixin<
    IPublicExportContext,
    Actor & IRootContext & IVaultContext & IItemContext
>(
    (Base) =>
        class PublicExportContext extends Base implements IPublicExportContext {
            #extractDefaultField(
                payload: VaultItemPayload,
                fieldId: PresetAutofillValue
            ): string | null {
                return (
                    payload.fields.find((f) => f.autofillMode.id === fieldId)
                        ?.value ?? null
                )
            }
            async exportVaultItems(vaultId: string): Promise<void> {
                let filename = ""
                const csvHeader = [
                    "name",
                    "origins",
                    "encrypted",
                    "loginUrl",
                    "restrictUrl",
                    "fieldsJson",
                    ...DEFAULT_FIELDS,
                ]
                const csvRows: CsvRow[] = [csvHeader]
                await this._post(`exportVault(${vaultId})`, async () => {
                    const items = await this._exportVaultItems(vaultId)
                    for (const [item, payload] of items) {
                        csvRows.push([
                            item.name,
                            item.origins.join(","),
                            item.data.encrypted.toString(),
                            payload.loginUrl ?? null,
                            payload.restrictUrl ?? null,
                            JSON.stringify(payload.fields),
                            ...DEFAULT_FIELDS.map((fieldId) =>
                                this.#extractDefaultField(payload, fieldId)
                            ),
                        ])
                    }
                    const vaultInfo = this._getVaultInfo(vaultId)
                    const dateStr = new Date().toISOString().slice(0, 10)
                    const sanitizedVaultName = sanitizeNameForExport(
                        vaultInfo?.payload.name
                    )
                    const sanitizedName = sanitizeNameForExport(
                        this._rootInfo?.payload.name
                    )
                    filename = `dpass-export-${sanitizedName}-${sanitizedVaultName}-${dateStr}.csv`
                })

                const blob = new Blob([Papa.unparse(csvRows)])
                DOWNLOAD_MANAGER.beginDownload(filename, blob)
            }
            async importVaultItems(
                _vaultId: string,
                _url: string
            ): Promise<void> {}
        }
)
