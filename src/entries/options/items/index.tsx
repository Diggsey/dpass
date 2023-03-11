import { FunctionalComponent } from "preact"
import { useMemo, useState } from "preact/hooks"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { computeItemDisplayName, VaultItem } from "~/entries/shared/state"
import { cn, usePromiseState } from "~/entries/shared/ui"
import { Item } from "./item"

type ItemInfo = {
    displayName: string
    vaultName: string
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

export const ItemsPage: FunctionalComponent<{ state: PrivilegedState }> = ({
    state,
}) => {
    const allItems = useMemo(() => {
        const allItems = Object.entries(state.vaults).flatMap(
            ([vaultId, vault]) =>
                Object.entries(vault.items || {}).map(([itemId, item]) => ({
                    displayName: computeItemDisplayName(item),
                    vaultName: state.vaults[vaultId].name,
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
    }, [state.vaults])

    const [searchTerm, setSearchTerm] = useState("")

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

    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const selectedItem = allItems.find((item) => item.itemId === selectedItemId)

    const itemHeaders = filteredItems.map((itemInfo) => (
        <div
            key={itemInfo.itemId}
            class={cn({
                box: true,
                isClickable: true,
                hasBackgroundLight: itemInfo.itemId !== selectedItemId,
            })}
            onClick={() => setSelectedItemId(itemInfo.itemId)}
        >
            <h4>{itemInfo.displayName}</h4>
            <h5>{itemInfo.vaultName}</h5>
        </div>
    ))
    const itemView = selectedItem ? (
        <Item
            key={selectedItemId}
            vaultId={selectedItem.vaultId}
            itemId={selectedItem.itemId}
            item={selectedItem.item}
        />
    ) : (
        <div>No item selected</div>
    )

    const [creatingItem, createItem] = usePromiseState(async () => {
        const vaultId = Object.keys(state.vaults)[0]
        const name = prompt("Enter item name:", "Unnamed")
        if (!name) {
            return
        }
        await sendMessage({
            id: "createVaultItem",
            vaultId,
            details: {
                name,
                origins: [],
                encrypted: false,
                payload: {
                    fields: [],
                },
            },
        })
    }, [state.vaults])

    return (
        <div class="is-flex is-flex-direction-row">
            <div>
                <div>
                    <IconButton
                        class={cn({ isLoading: creatingItem.inProgress })}
                        iconClass="fas fa-location-dot"
                        disabled={creatingItem.inProgress}
                        onClick={createItem}
                    >
                        Create New Item
                    </IconButton>
                </div>
                <div>
                    <input
                        type="text"
                        value={searchTerm}
                        onInput={(e) => setSearchTerm(e.currentTarget.value)}
                    />
                </div>
                <div>{itemHeaders}</div>
            </div>
            <div class="is-flex-grow-1">{itemView}</div>
        </div>
    )
}
