import { FC, useMemo } from "react"
import { cn } from "../ui"
import { Select } from "./styledElem"

type VaultMap = {
    readonly [vaultId: string]: {
        readonly name: string
        readonly missing: boolean
    }
}

type VaultSelectorProps = {
    vaults: VaultMap
    defaultVaultId?: string | null
    allowAll?: boolean
    value: string | null
    onChange: (value: string | null) => void
}

export const VaultSelector: FC<VaultSelectorProps> = ({
    vaults,
    defaultVaultId,
    allowAll,
    value,
    onChange,
}) => {
    const vaultOptions = useMemo(
        () =>
            Object.entries(vaults).sort((a, b) =>
                a[1].name.localeCompare(b[1].name)
            ),
        [vaults]
    )
    const classForItem = (vaultId: string | null) =>
        cn(
            vaultId === null ? "italic" : "not-italic",
            vaultId === defaultVaultId ? "font-bold" : "font-normal",
            vaultId !== null && vaults[vaultId]?.missing
                ? "text-red-700"
                : "text-gray-900"
        )
    return (
        <Select
            className={classForItem(value)}
            value={value ?? ""}
            onChange={(e) => onChange(e.currentTarget.value || null)}
        >
            {allowAll && (
                <option value="" className={classForItem(null)}>
                    All vaults
                </option>
            )}
            {vaultOptions.map(([vaultId, vault]) => (
                <option
                    key={vaultId}
                    value={vaultId}
                    className={classForItem(vaultId)}
                >
                    {vault.name}
                </option>
            ))}
        </Select>
    )
}
