import { FC, useCallback, useEffect, useState } from "react"
import "@fortawesome/fontawesome-free/css/all.css"
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
import { IconButton } from "../shared/components/iconButton"
import { sendMessage } from "../shared/messages"
import { objectKey } from "../shared"
import { cn } from "../shared/ui"
import { VaultSelector } from "../shared/components/vaultSelector"
import {
    useFilteredVaultItems,
    usePromiseState,
    useSharedPromiseState,
} from "../shared/ui/hooks"

type AutofillInnerProps = {
    state: UnprivilegedState
} & ModalProps<"autofillEmbed">

const AutofillInner: FC<AutofillInnerProps> = ({ state, args, resolve }) => {
    const sharedPromiseState = useSharedPromiseState()
    const [selectedVaultId, selectVault] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState("")

    const { allItems, filteredItems } = useFilteredVaultItems(
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

    useEffect(() => {
        if (allItems.length === 1 && !args.manual) {
            autofillItem(allItems[0])
        }
    }, [allItems.length, args.manual])

    return (
        <div className="columns is-mobile">
            <div className="column">
                <VaultSelector
                    vaults={state.vaults}
                    value={selectedVaultId}
                    onChange={selectVault}
                    defaultVaultId={state.defaultVaultId}
                    allowAll
                />
                <div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.currentTarget.value)}
                    />
                </div>
                {filteredItems.map((item) => (
                    <AutofillItem
                        item={item}
                        autofillItem={autofillItem}
                        updateItem={updateItem}
                        sharedPromiseState={sharedPromiseState}
                    />
                ))}
                {filteredItems.length === 0 ? (
                    <div>No applicable vault items</div>
                ) : null}
                <div className="is-flex is-flex-wrap-wrap gap-1">
                    <IconButton
                        className={cn({ isLoading: creatingItem.inProgress })}
                        iconClass="fas fa-plus"
                        disabled={sharedPromiseState.inProgress}
                        onClick={createItem}
                    >
                        Create new item
                    </IconButton>
                    <button
                        type="button"
                        className="button"
                        disabled={sharedPromiseState.inProgress}
                        onClick={() => resolve(null)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
            <div className="column">
                {fields.map((f, i) => (
                    <Field
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
                <div className="field">
                    <div className="control">
                        <IconButton
                            iconClass="fas fa-plus"
                            disabled={sharedPromiseState.inProgress}
                            onClick={addField}
                        >
                            Add new field
                        </IconButton>
                    </div>
                </div>
            </div>
        </div>
    )
}

const AutofillEmbed: FC<ModalProps<"autofillEmbed">> = ({
    args,
    resolve,
    reject,
}) => {
    const state = useUnprivilegedState(args.origin)
    return (
        <article className="panel is-primary">
            <p className="panel-heading">
                <div className="icon-text">
                    <span className="icon">
                        <i className="fas fa-pen-to-square"></i>
                    </span>
                    <span>dpass: Auto-fill</span>
                </div>
            </p>
            <div className="panel-block">
                {state ? (
                    <AutofillInner
                        state={state}
                        args={args}
                        resolve={resolve}
                        reject={reject}
                    />
                ) : (
                    <div className="loader" />
                )}
            </div>
        </article>
    )
}

renderModal("autofillEmbed", AutofillEmbed)
