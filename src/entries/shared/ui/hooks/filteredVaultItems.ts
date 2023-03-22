import { useMemo } from "react"
import { computeItemDisplayName, VaultItem, VaultItemMap } from "../../state"

type VaultMap = {
    readonly [vaultId: string]: {
        readonly name: string
        readonly items: VaultItemMap | null
    }
}

export type ItemInfo = {
    displayName: string
    vaultName: string
    logoUrl: string | null
    vaultId: string
    itemId: string
    item: VaultItem
}

function computeFieldSearchScore(searchTerm: string, value: string): number {
    const idx = value.indexOf(searchTerm)
    if (idx === -1) {
        return 0
    }
    let score = searchTerm.length / value.length
    if (idx === 0) {
        score += 1.0
    }
    return score
}

function computeItemSearchScore(
    searchTerms: string[],
    itemInfo: ItemInfo
): number {
    const fieldWeights: [string, number][] = [
        [itemInfo.displayName.toLowerCase(), 10],
        [itemInfo.vaultName.toLowerCase(), 1],
    ]
    for (const origin of itemInfo.item.origins) {
        fieldWeights.push([origin.toLowerCase(), 2])
    }
    const itemData = itemInfo.item.data
    if (!itemData.encrypted) {
        for (const field of itemData.payload.fields) {
            fieldWeights.push([field.value.toLowerCase(), 1])
        }
    }
    return searchTerms
        .map((searchTerm) =>
            Math.max(
                ...fieldWeights.map(
                    ([value, weight]) =>
                        computeFieldSearchScore(searchTerm, value) * weight
                )
            )
        )
        .reduce((a, b) => a + b, 0)
}

function computeLogoUrl(item: VaultItem): string | null {
    const domain = item.origins[0]
    if (domain) {
        return (
            "https://www.google.com/s2/favicons?" +
            new URLSearchParams({
                domain,
                sz: "32",
            })
        )
    }
    return null
}

function useFilteredVaultItems(
    vaultMap: VaultMap,
    selectedVaultId: string | null,
    searchTerm: string
): { allItems: ItemInfo[]; filteredItems: ItemInfo[] } {
    const allItems = useMemo(() => {
        const vaults = selectedVaultId
            ? [[selectedVaultId, vaultMap[selectedVaultId]] as const]
            : Object.entries(vaultMap)
        const allItems = vaults.flatMap(([vaultId, vault]) =>
            Object.entries(vault.items || {}).map(([itemId, item]) => ({
                displayName: computeItemDisplayName(item),
                vaultName: vaultMap[vaultId].name,
                logoUrl: computeLogoUrl(item),
                vaultId,
                itemId,
                item,
            }))
        )
        allItems.sort(
            (a, b) =>
                a.displayName.localeCompare(b.displayName) ||
                a.vaultName.localeCompare(b.vaultName) ||
                a.itemId.localeCompare(b.itemId)
        )
        return allItems
    }, [vaultMap, selectedVaultId])

    const filteredItems = useMemo(() => {
        const searchTerms = searchTerm
            .toLowerCase()
            .split(" ")
            .filter((term) => term.length > 0)
        if (searchTerms.length == 0) {
            return allItems
        }
        const filteredItems = allItems
            .map((itemInfo): [number, ItemInfo] => [
                computeItemSearchScore(searchTerms, itemInfo),
                itemInfo,
            ])
            .filter(([score, _itemInfo]) => score > 0.0)
        filteredItems.sort((a, b) => b[0] - a[0])
        return filteredItems.map(([_score, itemInfo]) => itemInfo)
    }, [allItems, searchTerm])

    return { allItems, filteredItems }
}

export default useFilteredVaultItems
