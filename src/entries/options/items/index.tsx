import { FunctionalComponent } from "preact"
import { useMemo, useState } from "preact/hooks"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { computeItemDisplayName, VaultItem } from "~/entries/shared/state"

type ItemInfo = {
    displayName: string,
    vaultName: string,
    vaultId: string,
    itemId: string,
    item: VaultItem,
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

function computeItemSearchScore(searchTerms: string[], itemInfo: ItemInfo): number {
    const fieldWeights: [string, number][] = [
        [itemInfo.displayName.toLowerCase(), 10],
        [itemInfo.vaultName.toLowerCase(), 1],
    ]
    if (itemInfo.item.origin) {
        fieldWeights.push([itemInfo.item.origin.toLowerCase(), 2])
    }
    const itemData = itemInfo.item.data
    if (!itemData.encrypted) {
        for (const field of itemData.payload.fields) {
            fieldWeights.push([field.value.toLowerCase(), 1])
        }
    }
    return searchTerms.map(searchTerm => (
        Math.max(...fieldWeights.map(([value, weight]) => computeFieldSearchScore(searchTerm, value) * weight))
    )).reduce((a, b) => a + b, 0)
}

export const ItemsPage: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
    const allItems = useMemo(() => {
        const allItems = Object.entries(state.vaults)
            .flatMap(([vaultId, vault]) => Object.entries(vault.items || {})
                .map(([itemId, item]) => ({
                    displayName: computeItemDisplayName(item),
                    vaultName: state.vaults[vaultId].name,
                    vaultId,
                    itemId,
                    item,
                }))
            )
        allItems.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.vaultName.localeCompare(b.vaultName) || a.itemId.localeCompare(b.itemId))
        return allItems
    }, [state.vaults])

    const [searchTerm, setSearchTerm] = useState("")

    const filteredItems = useMemo(() => {
        const searchTerms = searchTerm.toLowerCase().split(" ").filter(term => term.length > 0)
        if (searchTerms.length == 0) {
            return allItems
        }
        const filteredItems = allItems
            .map((itemInfo): [number, ItemInfo] => [computeItemSearchScore(searchTerms, itemInfo), itemInfo])
            .filter(([score, _itemInfo]) => score > 0.0)
        filteredItems.sort((a, b) => a[0] - b[0])
        return filteredItems.map(([_score, itemInfo]) => itemInfo)
    }, [allItems, searchTerm])

    const tableRows = filteredItems.map(itemInfo => (
        <tr key={itemInfo.itemId}>
            <td>{itemInfo.displayName}</td>
            <td>{itemInfo.vaultName}</td>
        </tr>
    ))

    return <>
        <div>
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.currentTarget.value)} />
        </div>
        <table class="table">
            <tbody>
                {tableRows}
            </tbody>
        </table>
    </>
}