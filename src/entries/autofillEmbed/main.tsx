import { FC, useCallback, useState } from "react"
import "./style.css"
import { ModalProps, renderModal } from "../shared/modal"
import { useUnprivilegedState } from "../shared/unprivileged"
import {
    UnprivilegedState,
    VaultItem,
    VaultItemField,
    VaultItemPayload,
} from "../shared/state"
import { AutofillItem } from "./item"
import { defaultName } from "../shared/autofill"
import { Field } from "../shared/components/field"
import { sendMessage } from "../shared/messages"
import { objectKey } from "../shared"
import { VaultSelector } from "../shared/components/vaultSelector"
import {
    useFilteredVaultItems,
    usePromiseState,
    useSharedPromiseState,
} from "../shared/ui/hooks"
import { ReorderableList } from "../shared/components/reorderableList"
import {
    Card,
    Input,
    PrimaryButton,
    SecondaryButton,
    TextButton,
} from "../shared/components/styledElem"
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline"
import { ButtonIcon } from "../shared/components/buttonIcon"
import { Loader } from "../shared/components/icons/loader"
import { DPassIcon } from "../shared/components/icons/dpass"

type AutofillInnerProps = {
    state: UnprivilegedState
} & ModalProps<"autofillEmbed">

const AutofillInner: FC<AutofillInnerProps> = ({ state, args, resolve }) => {
    const sharedPromiseState = useSharedPromiseState()
    const [selectedVaultId, selectVault] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    const { filteredItems } = useFilteredVaultItems(
        state.vaults,
        selectedVaultId,
        searchTerm
    )
    const [fields, setFields] = useState<VaultItemField[]>(() =>
        args.fields.map((f) => ({
            uuid: crypto.randomUUID(),
            name: defaultName(f.autofillModes[0]),
            autofillMode: f.autofillModes[0],
            value: f.value,
        }))
    )

    const addField = () => {
        setFields([
            ...fields,
            {
                uuid: crypto.randomUUID(),
                name: "Password",
                autofillMode: { id: "password" },
                value: "",
            },
        ])
    }

    const autofillItem = useCallback(
        ({ vaultId, itemId }: { vaultId: string; itemId: string }) => {
            resolve({
                id: "requestAutofill",
                vaultId,
                itemId,
            })
        },
        []
    )

    const updateItem = useCallback(
        async ({
            vaultId,
            itemId,
            item,
        }: {
            vaultId: string
            itemId: string
            item: VaultItem
        }) => {
            let payload: VaultItemPayload | undefined
            if (item.data.encrypted) {
                payload = await sendMessage({
                    id: "decryptVaultItem",
                    vaultId,
                    itemId,
                })
                if (!payload) {
                    throw new Error("Failed to decrypt vault item")
                }
            } else {
                payload = item.data.payload
            }
            const autofillValuesToReplace = new Set(
                fields
                    .filter((f) => f.value !== "")
                    .map((f) => objectKey(f.autofillMode))
            )
            const newFields = payload.fields
                .filter(
                    (f) =>
                        !autofillValuesToReplace.has(objectKey(f.autofillMode))
                )
                .concat(fields)
            await sendMessage({
                id: "updateVaultItem",
                vaultId,
                itemId,
                details: {
                    name: item.name,
                    origins: item.origins,
                    encrypted: item.data.encrypted,
                    payload: {
                        ...payload,
                        fields: newFields,
                    },
                },
            })
            resolve(null)
        },
        [fields]
    )

    const [creatingItem, createItem] = usePromiseState(
        async () => {
            const chosenVaultId = selectedVaultId ?? state.defaultVaultId
            if (!chosenVaultId) {
                throw new Error("No default vault")
            }
            const itemId = await sendMessage({
                id: "createVaultItem",
                vaultId: chosenVaultId,
                details: {
                    name: args.title,
                    origins: [args.origin],
                    encrypted: false,
                    payload: {
                        login_url: args.url,
                        fields,
                    },
                },
            })
            if (itemId) {
                await sendMessage({
                    id: "openOptionsPage",
                    target: {
                        id: "item",
                        itemId,
                    },
                })
            }
            resolve(null)
        },
        [fields],
        sharedPromiseState
    )

    const reorderFields = (sourceIndex: number, destIndex: number) => {
        const newFields = [...fields]
        const [movedField] = newFields.splice(sourceIndex, 1)
        newFields.splice(destIndex, 0, movedField)
        setFields(newFields)
    }
    return (
        <>
            <div className="grid grid-flow-col divide-x divide-gray-200 auto-cols-min">
                <div className="grid grid-rows-[max-content] min-w-[300px]">
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
                        </div>
                    </div>
                    <div className="overflow-y-auto divide-y divide-gray-200 [container-type:size] min-h-[300px]">
                        {filteredItems.map((item) => (
                            <AutofillItem
                                item={item}
                                autofillItem={autofillItem}
                                updateItem={updateItem}
                                sharedPromiseState={sharedPromiseState}
                            />
                        ))}
                        {filteredItems.length === 0 ? (
                            <div className="p-3">No applicable vault items</div>
                        ) : null}
                    </div>
                </div>
                <div className="grid p-5 gap-5 auto-rows-max">
                    <ReorderableList
                        onReorder={reorderFields}
                        className="-mt-4"
                    >
                        {fields.map((f, i) => (
                            <Field
                                index={i}
                                field={f}
                                onUpdate={(nf) =>
                                    setFields([
                                        ...fields.slice(0, i),
                                        nf,
                                        ...fields.slice(i + 1),
                                    ])
                                }
                                onDelete={() =>
                                    setFields([
                                        ...fields.slice(0, i),
                                        ...fields.slice(i + 1),
                                    ])
                                }
                            />
                        ))}
                    </ReorderableList>
                    <div>
                        <TextButton
                            onClick={addField}
                            disabled={sharedPromiseState.inProgress}
                        >
                            <ButtonIcon icon={PlusIcon} />
                            <span>Add new field</span>
                        </TextButton>
                    </div>
                </div>
            </div>
            <Card.Footer>
                <div className="flex items-center justify-end gap-3">
                    <SecondaryButton
                        type="button"
                        className="button"
                        disabled={sharedPromiseState.inProgress}
                        onClick={() => resolve(null)}
                    >
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton
                        disabled={sharedPromiseState.inProgress}
                        onClick={createItem}
                    >
                        <ButtonIcon
                            icon={creatingItem.inProgress ? Loader : PlusIcon}
                        />
                        <span>New item</span>
                    </PrimaryButton>
                </div>
            </Card.Footer>
        </>
    )
}

const AutofillEmbed: FC<ModalProps<"autofillEmbed">> = ({
    args,
    resolve,
    reject,
}) => {
    const state = useUnprivilegedState(args.origin)
    return (
        <Card>
            <Card.Header className="flex items-center gap-3">
                <DPassIcon className="w-6 h-6" />
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                    dpass: Auto-fill
                </h3>
            </Card.Header>

            {state ? (
                <AutofillInner
                    state={state}
                    args={args}
                    resolve={resolve}
                    reject={reject}
                />
            ) : (
                <Card.Body>
                    <div className="loader" />
                </Card.Body>
            )}
        </Card>
    )
}

renderModal("autofillEmbed", AutofillEmbed)
