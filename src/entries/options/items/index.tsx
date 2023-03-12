import { FunctionalComponent } from "preact"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import {
    cn,
    useFilteredVaultItems,
    useLocalState,
    usePromiseState,
} from "~/entries/shared/ui"
import { Item } from "./item"
import { VaultSelector } from "~/entries/shared/components/vaultSelector"

export const ItemsPage: FunctionalComponent<{ state: PrivilegedState }> = ({
    state,
}) => {
    const [selectedVaultId, selectVault] = useLocalState<string | null>(
        "selectedVaultId",
        null
    )

    const [searchTerm, setSearchTerm] = useLocalState<string>(
        "itemSearchTerm",
        ""
    )

    const { allItems, filteredItems } = useFilteredVaultItems(
        state.vaults,
        selectedVaultId,
        searchTerm
    )

    const [selectedItemId, selectItem] = useLocalState<string | null>(
        "selectedItemId",
        null
    )
    const selectedItem = allItems.find((item) => item.itemId === selectedItemId)

    const itemHeaders = filteredItems.map((itemInfo) => (
        <div
            key={itemInfo.itemId}
            class={cn("box is-clickable is-flex is-flex-direction-row gap-1", {
                hasBackgroundLight: itemInfo.itemId !== selectedItemId,
            })}
            onClick={() => selectItem(itemInfo.itemId)}
        >
            {itemInfo.logoUrl && (
                <img
                    src={itemInfo.logoUrl}
                    class="is-align-self-center"
                    alt="logo"
                    width="32"
                    height="32"
                />
            )}
            <div>
                <h4>{itemInfo.displayName}</h4>
                <h5>{itemInfo.vaultName}</h5>
            </div>
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
        const vaultId =
            selectedVaultId ??
            state.defaultVaultId ??
            Object.keys(state.vaults)[0]
        const itemId = await sendMessage({
            id: "createVaultItem",
            vaultId,
            details: {
                name: "Unnamed",
                origins: [],
                encrypted: false,
                payload: {
                    fields: [],
                },
            },
        })
        if (itemId) {
            selectItem(itemId)
        }
    }, [state.vaults])

    return (
        <div class="is-flex is-flex-direction-row">
            <div class="is-flex is-flex-direction-column gap-1">
                <div>
                    <VaultSelector
                        vaults={state.vaults}
                        value={selectedVaultId}
                        onChange={selectVault}
                        defaultVaultId={state.defaultVaultId}
                        allowAll
                    />
                </div>
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
