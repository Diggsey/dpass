import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IRootContext } from "./rootContext"
import { IVaultContext } from "./vaultContext"
import host from "~/entries/shared/host"
import { IItemContext } from "./itemContext"
import { VaultItemField, VaultItemPayload } from "~/entries/shared/state"
import {
    AutofillMode,
    PRESET_AUTOFILL_VALUES,
    PresetAutofillValue,
    defaultName,
} from "~/entries/shared/autofill"
import { sanitizeNameForExport } from "~/entries/shared"
import Papa from "papaparse"
import { ItemDetails } from "~/entries/shared/messages/vault"
import { ISuperKeyContext } from "./superKeyContext"

export interface IPublicExportContext {
    exportVaultItems(vaultId: string): Promise<void>
    importVaultItems(vaultId: string, url: string): Promise<void>
}

type CsvValue = null | boolean | number | string
type CsvRow = CsvValue[]

const DEFAULT_FIELDS = ["username", "email", "password", "note"] as const
const COLUMNS = [
    "name",
    "origins",
    "encrypted",
    "loginUrl",
    "restrictUrl",
    "fieldsJson",
    ...DEFAULT_FIELDS,
] as const

type CsvImportRow = Readonly<Partial<Record<(typeof COLUMNS)[number], string>>>

function parseBoolean(value: string | undefined): boolean {
    if (!value) {
        return false
    }
    value = value.toLowerCase().trim()
    if (["1", "t", "true", "y", "yes"].includes(value)) {
        return true
    }
    if (["", "0", "f", "false", "n", "no"].includes(value)) {
        return false
    }
    throw new Error(`Expected boolean value, found '${value}'`)
}

function validateAutofillMode(value: unknown): AutofillMode {
    if (
        typeof value !== "object" ||
        value === null ||
        !("id" in value) ||
        typeof value.id !== "string"
    ) {
        return { id: "password" }
    }
    const presetId = PRESET_AUTOFILL_VALUES.find((x) => x === value.id)
    if (presetId !== undefined) {
        return { id: presetId }
    }
    if (value.id !== "custom") {
        throw new Error("Unknown autofill mode")
    }
    return {
        id: "custom",
        key: "key" in value && typeof value.key === "string" ? value.key : "",
    }
}

function parseFields(value: string | undefined): VaultItemField[] | undefined {
    if (!value) {
        return undefined
    }
    const parsedFields: unknown = JSON.parse(value)
    if (!Array.isArray(parsedFields)) {
        return undefined
    }

    const result = []
    const parsedFields2: unknown[] = parsedFields
    for (const parsedField of parsedFields2) {
        if (typeof parsedField !== "object" || parsedField === null) {
            continue
        }
        const autofillMode: AutofillMode =
            "autofillMode" in parsedField
                ? validateAutofillMode(parsedField.autofillMode)
                : { id: "password" }
        const field: VaultItemField = {
            uuid: crypto.randomUUID(),
            name:
                "name" in parsedField && typeof parsedField.name === "string"
                    ? parsedField.name
                    : defaultName(autofillMode),
            value:
                "value" in parsedField && typeof parsedField.value === "string"
                    ? parsedField.value
                    : "",
            autofillMode,
        }
        result.push(field)
    }
    return result.length > 0 ? result : undefined
}

function parseBackupFields(csvRow: CsvImportRow): VaultItemField[] {
    const result = []
    for (const defaultField of DEFAULT_FIELDS) {
        const value = csvRow[defaultField]
        if (typeof value === "string") {
            const autofillMode = { id: defaultField }
            result.push({
                uuid: crypto.randomUUID(),
                name: defaultName(autofillMode),
                value,
                autofillMode,
            })
        }
    }
    return result
}

// Public methods for interacting with vault items
export const PublicExportContext = mixin<
    IPublicExportContext,
    Actor & IRootContext & IVaultContext & IItemContext & ISuperKeyContext
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
                await this._postWithRetryIfLocked(
                    `exportVaultItems(${vaultId})`,
                    async () => {
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
                    }
                )

                const blob = new Blob([Papa.unparse(csvRows)], {
                    type: "text/csv",
                })
                host.beginDownload(filename, blob)
            }
            async importVaultItems(
                vaultId: string,
                url: string
            ): Promise<void> {
                this.trace`importVaultItems(${url})`

                const resp = await fetch(url)
                const csvString = await resp.text()

                const result = Papa.parse(csvString, { header: true })
                if (result.errors.length > 0) {
                    throw new Error(
                        `Errors while decoding CSV file: ${JSON.stringify(
                            result.errors
                        )}`
                    )
                }
                const csvRows = result.data as readonly CsvImportRow[]
                const items: ItemDetails[] = []

                for (const csvRow of csvRows) {
                    items.push({
                        name: csvRow.name ?? "",
                        origins: csvRow.origins
                            ? csvRow.origins
                                  .split(",")
                                  .map((origin) => origin.trim())
                            : [],
                        encrypted: parseBoolean(csvRow.encrypted),
                        payload: {
                            loginUrl: csvRow.loginUrl || undefined,
                            restrictUrl:
                                parseBoolean(csvRow.restrictUrl) || undefined,
                            fields:
                                parseFields(csvRow.fieldsJson) ??
                                parseBackupFields(csvRow),
                        },
                    })
                }

                await this._postWithRetryIfLocked(
                    `_importVaultItems(${vaultId})`,
                    async () => {
                        await this._importVaultItems(vaultId, items)
                    }
                )
            }
        }
)
