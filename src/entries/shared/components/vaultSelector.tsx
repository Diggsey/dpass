import { FunctionalComponent } from "preact"
import { useMemo } from "preact/hooks"
import { cn } from "../ui"
import "./vaultSelector.css"

type VaultMap = {
    readonly [vaultId: string]: {
        readonly name: string
    }
}

type VaultSelectorProps = {
    vaults: VaultMap
    defaultVaultId?: string | null
    allowAll?: boolean
    value: string | null
    onChange: (value: string | null) => void
}

export const VaultSelector: FunctionalComponent<VaultSelectorProps> = ({
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
        cn({
            isItalic: vaultId === null,
            hasTextWeightBold: vaultId === defaultVaultId,
        })
    return (
        <div class="select">
            <select
                class={classForItem(value)}
                value={value ?? ""}
                onChange={(e) => onChange(e.currentTarget.value || null)}
            >
                {allowAll && (
                    <option value="" class={classForItem(null)}>
                        All vaults
                    </option>
                )}
                {vaultOptions.map(([vaultId, vault]) => (
                    <option
                        key={vaultId}
                        value={vaultId}
                        class={classForItem(vaultId)}
                    >
                        {vault.name}
                    </option>
                ))}
            </select>
        </div>
    )
}
