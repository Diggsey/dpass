import { FC, useCallback } from "react"
import { IconButton } from "../shared/components/iconButton"
import { sendMessage } from "../shared/messages"
import { VaultItem } from "../shared/state"
import { cn, SharedPromiseState, usePromiseState } from "../shared/ui"

type ItemInfo = {
    displayName: string
    vaultName: string
    vaultId: string
    itemId: string
    item: VaultItem
}

type AutofillItemProps = {
    item: ItemInfo
    autofillItem: (item: ItemInfo) => void
    updateItem: (item: ItemInfo) => Promise<void>
    sharedPromiseState: SharedPromiseState
}

export const AutofillItem: FC<AutofillItemProps> = ({
    item,
    autofillItem,
    updateItem,
    sharedPromiseState,
}) => {
    const [updatingItem, updateItemFn] = usePromiseState(
        () => updateItem(item),
        [updateItem],
        sharedPromiseState
    )
    const viewItem = useCallback(async () => {
        await sendMessage({
            id: "openOptionsPage",
            target: {
                id: "item",
                itemId: item.itemId,
            },
        })
    }, [item.itemId])
    return (
        <div className="box">
            <h4>{item.displayName}</h4>
            <h5>{item.vaultName}</h5>
            <div className="is-flex is-flex-direction-row gap-1">
                <IconButton
                    className={cn({ isLoading: updatingItem.inProgress })}
                    iconClass="fas fa-eye"
                    disabled={sharedPromiseState.inProgress}
                    onClick={viewItem}
                >
                    View
                </IconButton>
                <IconButton
                    iconClass="fas fa-wand-magic-sparkles"
                    disabled={sharedPromiseState.inProgress}
                    onClick={() => autofillItem(item)}
                >
                    Auto-fill
                </IconButton>
                <IconButton
                    className={cn({ isLoading: updatingItem.inProgress })}
                    iconClass="fas fa-arrow-left"
                    iconSide="right"
                    disabled={sharedPromiseState.inProgress}
                    onClick={updateItemFn}
                >
                    Update
                </IconButton>
            </div>
        </div>
    )
}
