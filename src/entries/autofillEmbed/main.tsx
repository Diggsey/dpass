import { FunctionalComponent } from "preact"
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import "./style.css"
import { ModalProps, renderModal } from "../shared/modal"
import { useUnprivilegedState } from "../shared/unprivileged"
import { useCallback, useEffect, useMemo, useState } from "preact/hooks"
import {
    computeItemDisplayName,
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
import { cn, usePromiseState, useSharedPromiseState } from "../shared/ui"
import { VaultSelector } from "../shared/components/vaultSelector"

type AutofillInnerProps = {
    state: UnprivilegedState
} & ModalProps<"autofillEmbed">

const AutofillInner: FunctionalComponent<AutofillInnerProps> = ({
    state,
    args,
    resolve,
}) => {
    const sharedPromiseState = useSharedPromiseState()
    const [selectedVaultId, selectVault] = useState<string | null>(null)

    const allItems = useMemo(() => {
        const vaults = selectedVaultId
            ? [[selectedVaultId, state.vaults[selectedVaultId]] as const]
            : Object.entries(state.vaults)
        const allItems = vaults.flatMap(([vaultId, vault]) =>
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
    }, [state.vaults, selectedVaultId])
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
            await sendMessage({
                id: "createVaultItem",
                vaultId: chosenVaultId,
                details: {
                    name: args.origin,
                    origins: [args.origin],
                    encrypted: false,
                    payload: {
                        login_url: args.url,
                        fields,
                    },
                },
            })
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
        <div class="columns is-mobile">
            <div class="column">
                <VaultSelector
                    vaults={state.vaults}
                    value={selectedVaultId}
                    onChange={selectVault}
                    defaultVaultId={state.defaultVaultId}
                    allowAll
                />
                {allItems.map((item) => (
                    <AutofillItem
                        item={item}
                        autofillItem={autofillItem}
                        updateItem={updateItem}
                        sharedPromiseState={sharedPromiseState}
                    />
                ))}
                {allItems.length === 0 ? (
                    <div>No applicable vault items</div>
                ) : null}
                <div>
                    <IconButton
                        class={cn({ isLoading: creatingItem.inProgress })}
                        iconClass="fas fa-plus"
                        disabled={sharedPromiseState.inProgress}
                        onClick={createItem}
                    >
                        Create new item
                    </IconButton>
                    <button
                        type="button"
                        class="button"
                        disabled={sharedPromiseState.inProgress}
                        onClick={() => resolve(null)}
                    >
                        Cancel
                    </button>
                </div>
            </div>
            <div class="column">
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
                <div class="field">
                    <div class="control">
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

const AutofillEmbed: FunctionalComponent<ModalProps<"autofillEmbed">> = ({
    args,
    resolve,
    reject,
}) => {
    const state = useUnprivilegedState(args.origin)
    return (
        <article class="panel is-primary">
            <p class="panel-heading">
                <div class="icon-text">
                    <span class="icon">
                        <i class="fas fa-pen-to-square"></i>
                    </span>
                    <span>dpass: Auto-fill</span>
                </div>
            </p>
            <div class="panel-block">
                {state ? (
                    <AutofillInner
                        state={state}
                        args={args}
                        resolve={resolve}
                        reject={reject}
                    />
                ) : (
                    <div class="loader" />
                )}
            </div>
        </article>
    )
}

renderModal("autofillEmbed", AutofillEmbed)
