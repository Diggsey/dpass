import { FC } from "react"
import { sendMessage } from "~/entries/shared/messages"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { cn } from "~/entries/shared/ui"
import { Item } from "./item"
import { VaultSelector } from "~/entries/shared/components/vaultSelector"
import {
    useFilteredVaultItems,
    useLocalState,
    usePromiseState,
} from "~/entries/shared/ui/hooks"
import { Slide } from "~/entries/shared/components/slide"
import {
    Input,
    PrimaryButton,
    TextButton,
} from "~/entries/shared/components/styledElem"
import {
    ChevronLeftIcon,
    MagnifyingGlassIcon,
    PlusIcon,
} from "@heroicons/react/24/outline"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { RadioGroup } from "@headlessui/react"
import { MagicVScroll } from "~/entries/shared/components/magicVScroll"

export const ItemsPage: FC<{ state: PrivilegedState }> = ({ state }) => {
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
        <RadioGroup.Option
            key={itemInfo.itemId}
            value={itemInfo.itemId}
            className={({ checked }) =>
                cn(
                    checked
                        ? "z-10 border-indigo-200 bg-indigo-50"
                        : "border-gray-200 hover:bg-gray-50",
                    "relative flex cursor-pointer flex-row border p-4 focus:outline-none"
                )
            }
        >
            {({ checked }) => (
                <>
                    <span className="flex items-center text-sm w-[32px] h-[32px]">
                        {itemInfo.logoUrl && (
                            <img
                                src={itemInfo.logoUrl}
                                className="is-align-self-center"
                                alt="logo"
                                width="32"
                                height="32"
                            />
                        )}
                    </span>
                    <span className="ml-3 flex flex-col text-sm">
                        <RadioGroup.Label
                            as="span"
                            className={cn(
                                checked ? "text-indigo-900" : "text-gray-900",
                                "block font-medium"
                            )}
                        >
                            {itemInfo.displayName}
                        </RadioGroup.Label>
                        <RadioGroup.Description
                            as="span"
                            className={
                                checked ? "text-indigo-700" : "text-gray-500"
                            }
                        >
                            {itemInfo.vaultName}
                        </RadioGroup.Description>
                    </span>
                </>
            )}
        </RadioGroup.Option>
    ))
    const itemView = selectedItem ? (
        <Item
            key={selectedItemId}
            vaultId={selectedItem.vaultId}
            itemId={selectedItem.itemId}
            item={selectedItem.item}
            displayName={selectedItem.displayName}
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
        <Slide
            open={selectedItemId !== null}
            slideClass="md:left-0 md:w-full min-h-full max-h-full items-stretch"
        >
            <Slide.Left
                persistent
                className="md:flex-1 bg-white md:max-w-md grid grid-rows-[max-content]"
            >
                <div className="grid bg-gray-200 p-3 gap-3">
                    <VaultSelector
                        vaults={state.vaults}
                        value={selectedVaultId}
                        onChange={selectVault}
                        defaultVaultId={state.defaultVaultId}
                        allowAll
                    />

                    <div className="flex justify-end flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MagnifyingGlassIcon
                                    className="h-5 w-5 text-gray-400"
                                    aria-hidden="true"
                                />
                            </div>
                            <Input
                                type="search"
                                className="pl-10 pr-3"
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) =>
                                    setSearchTerm(e.currentTarget.value)
                                }
                            />
                        </div>
                        <PrimaryButton
                            disabled={creatingItem.inProgress}
                            onClick={createItem}
                        >
                            <ButtonIcon icon={PlusIcon} />
                            <span>Add New</span>
                        </PrimaryButton>
                    </div>
                </div>
                <div className="overflow-y-auto">
                    <RadioGroup value={selectedItemId} onChange={selectItem}>
                        <div className="relative -space-y-px rounded-md bg-white">
                            {itemHeaders}
                        </div>
                    </RadioGroup>
                </div>
            </Slide.Left>
            <Slide.Right persistent className="md:flex-[2_2_0] grid">
                <MagicVScroll>
                    <div className="container grid mx-auto max-w-7xl sm:px-6 lg:px-8 pb-10 md:pt-10 auto-rows-max">
                        <div className="px-3 pt-5 pb-3 md:hidden">
                            <TextButton onClick={() => selectItem(null)}>
                                <ButtonIcon icon={ChevronLeftIcon} />
                                <span>Back to items</span>
                            </TextButton>
                        </div>
                        {itemView}
                    </div>
                </MagicVScroll>
            </Slide.Right>
        </Slide>
    )
}
