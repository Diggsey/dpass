import {
    ArrowLeftIcon,
    EyeIcon,
    PencilSquareIcon,
} from "@heroicons/react/24/outline"
import { FC, useCallback } from "react"
import { ButtonIcon } from "../shared/components/buttonIcon"
import { Loader } from "../shared/components/icons/loader"
import { TextButton } from "../shared/components/styledElem"
import { sendMessage } from "../shared/messages"
import { SharedPromiseState, usePromiseState } from "../shared/ui/hooks"
import { ItemInfo } from "../shared/ui/hooks/filteredVaultItems"

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
        <div className="relative group flex flex-row p-4 gap-3 hover:bg-gray-100">
            <span className="flex items-center text-sm w-[32px] h-[32px]">
                {item.logoUrl && (
                    <img
                        src={item.logoUrl}
                        className="is-align-self-center"
                        alt="logo"
                        width="32"
                        height="32"
                    />
                )}
            </span>
            <span className="flex flex-col text-sm flex-1">
                <span className="text-gray-900 font-medium">
                    <span>{item.displayName}</span>
                    <TextButton
                        className="align-middle mx-1 invisible group-hover:visible"
                        disabled={sharedPromiseState.inProgress}
                        onClick={viewItem}
                    >
                        <ButtonIcon icon={EyeIcon} />
                    </TextButton>
                </span>
                <span className="text-gray-500">{item.vaultName}</span>
            </span>
            <div className="grid gap-3 min-w-max shrink-0 auto-rows-max">
                <TextButton
                    className="group/button"
                    disabled={sharedPromiseState.inProgress}
                    onClick={() => autofillItem(item)}
                >
                    <span className="invisible group-hover/button:visible">
                        Auto-fill
                    </span>
                    <ButtonIcon icon={PencilSquareIcon} />
                </TextButton>
                <TextButton
                    className="group/button"
                    disabled={sharedPromiseState.inProgress}
                    onClick={updateItemFn}
                >
                    <span className="invisible group-hover/button:visible">
                        Update
                    </span>
                    <ButtonIcon
                        icon={updatingItem.inProgress ? Loader : ArrowLeftIcon}
                    />
                </TextButton>
            </div>
        </div>
    )
}
