import { FC, useCallback, useEffect, useId, useState } from "react"
import { sendMessage } from "~/entries/shared/messages"
import { Status } from "~/entries/shared/components/status"
import {
    VaultItem,
    VaultItemField,
    VaultItemPayload,
} from "~/entries/shared/state"
import { Field } from "../../shared/components/field"
import { ItemDetails } from "~/entries/shared/messages/vault"
import {
    useDebouncedEffect,
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import {
    Card,
    Checkbox,
    Input,
    Label,
    OutlineButton,
    PrimaryButton,
    TextButton,
} from "~/entries/shared/components/styledElem"
import { ButtonIcon } from "~/entries/shared/components/buttonIcon"
import { LockOpenIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline"
import { Loader } from "~/entries/shared/components/icons/loader"
import { AutoTextArea } from "~/entries/shared/components/autoTextArea"
import { ReorderableList } from "~/entries/shared/components/reorderableList"

type ItemProps = {
    vaultId: string
    itemId: string
    item: VaultItem
    displayName: string
}

function stripCarriageReturns(elem: HTMLTextAreaElement) {
    const value = elem.value
    if (value.includes("\r")) {
        const { selectionStart, selectionEnd, selectionDirection } = elem
        let adjustStart = 0
        let adjustEnd = 0
        elem.value = value.replaceAll("\r", (_m, offset) => {
            if (offset < selectionStart) {
                adjustStart += 1
            }
            if (offset < selectionEnd) {
                adjustEnd += 1
            }
            return ""
        })
        if (adjustEnd !== 0 || adjustStart !== 0) {
            elem.setSelectionRange(
                selectionStart - adjustStart,
                selectionEnd - adjustEnd,
                selectionDirection
            )
        }
    }
}

export const Item: FC<ItemProps> = ({ vaultId, itemId, item, displayName }) => {
    const itemAction = useSharedPromiseState()
    const fieldId = useId()

    // Not-null if there are local (unsaved) changes to the item.
    // Local payload changes are only stored here if the item is not encrypted.
    const [editedDetails, setEditedDetails] = useState<ItemDetails | null>(null)
    const [hasUnsaved, setHasUnsaved] = useState(false)

    // Not-null if the item is encrypted, but has been temporarily decrypted for editing.
    // Local changes are also made here if the item is encrypted.
    const [decryptedPayload, setDecryptedPayload] =
        useState<VaultItemPayload | null>(null)

    // Used to initiate an update to the item
    const updateItem = useCallback(
        (details: ItemDetails) => {
            // Immediately update our local state
            if (details.encrypted) {
                // For encrypted items, split payload and non-payload changes
                const { payload, ...rest } = details
                setEditedDetails(rest)
                // If there was a change to the payload, apply that change
                if (payload) {
                    setDecryptedPayload(payload)
                }
            } else {
                // For decrypted items, apply both payload and non-payload changes
                // directly to the edited details.
                setEditedDetails(details)

                // Clear the decrypted payload in case this item was just un-encrypted
                setDecryptedPayload(null)
            }
            setHasUnsaved(true)
        },
        [vaultId, itemId]
    )

    const [savingChanges, saveChanges] = usePromiseState(
        async (details: ItemDetails) => {
            setHasUnsaved(false)
            // Asynchronously propagate the change to the vault
            await sendMessage({
                id: "updateVaultItem",
                vaultId,
                itemId,
                details,
            })
        },
        [vaultId, itemId],
        itemAction
    )

    const inFlightChanges = hasUnsaved || savingChanges.inProgress

    // Delete this entire item
    const [deletingItem, deleteItem] = usePromiseState(
        async () => {
            await sendMessage({
                id: "deleteVaultItem",
                vaultId,
                itemId,
            })
        },
        [vaultId, itemId],
        itemAction
    )

    // Whenever we have unsaved changes, save them on a debounce
    useDebouncedEffect(
        () => {
            if (!savingChanges.inProgress && editedDetails && hasUnsaved) {
                void saveChanges(
                    decryptedPayload
                        ? {
                              ...editedDetails,
                              payload: decryptedPayload,
                          }
                        : editedDetails
                )
            }
        },
        100,
        [savingChanges.inProgress, editedDetails, decryptedPayload, hasUnsaved]
    )

    // If the latest asynchronous vault update is done then our local changes can
    // be discarded. Do this on a delay so we have time to receive the updates.
    useDebouncedEffect(
        () => {
            if (!inFlightChanges && editedDetails !== null) {
                setEditedDetails(null)
            }
        },
        100,
        [inFlightChanges, editedDetails !== null]
    )

    // Create a local view of the item, including any unsaved edits
    const itemDetails: ItemDetails = editedDetails || {
        name: item.name,
        origins: item.origins,
        encrypted: item.data.encrypted,
        payload: item.data.encrypted ? undefined : item.data.payload,
    }

    // If the item becomes decrypted, clear the decrypted payload because
    // the payload will no longer be stored there.
    useEffect(() => {
        if (!itemDetails.encrypted) {
            setDecryptedPayload(null)
        }
    }, [itemDetails.encrypted])
    // If the item becomes encrypted, clear the decrypted payload until
    // it is explicitly decrypted.
    useEffect(() => {
        if (item.data.encrypted) {
            setDecryptedPayload(null)
        }
    }, [item.data.encrypted])

    // Create a local view of the payload
    const payload = itemDetails.payload || decryptedPayload

    const payloadView = payload ? (
        <ItemPayload
            payload={payload}
            onUpdate={(newPayload) =>
                updateItem({ ...itemDetails, payload: newPayload })
            }
        />
    ) : (
        <LockedItem
            vaultId={vaultId}
            itemId={itemId}
            onUnlock={(payload) => setDecryptedPayload(payload)}
        />
    )

    return (
        <Card>
            <Card.Header className="flex flex-wrap items-center justify-between sm:flex-nowrap gap-3">
                <Input
                    type="text"
                    className="!ring-0 hover:bg-gray-100 !p-0 !shadow-none !text-base font-semibold text-gray-900 flex-1 max-w-md"
                    placeholder={displayName || "Name"}
                    value={itemDetails.name}
                    onChange={(e) =>
                        updateItem({
                            ...itemDetails,
                            name: e.currentTarget.value,
                        })
                    }
                />
                <div className="flex-shrink-0">
                    <OutlineButton
                        disabled={itemAction.inProgress || inFlightChanges}
                        onClick={deleteItem}
                    >
                        <ButtonIcon
                            icon={deletingItem.inProgress ? Loader : TrashIcon}
                        />
                        <span>Delete</span>
                    </OutlineButton>
                </div>
            </Card.Header>
            <Card.Body className="grid gap-4">
                <div>
                    <Label htmlFor={`${fieldId}-origins`}>Origins</Label>
                    <div className="relative mt-2 rounded-md shadow-sm font-mono">
                        <AutoTextArea
                            id={`${fieldId}-origins`}
                            className="max-h-48"
                            placeholder="example.com"
                            value={itemDetails.origins.join("\n")}
                            onChange={(e) => {
                                stripCarriageReturns(e.currentTarget)
                                void updateItem({
                                    ...itemDetails,
                                    origins: e.currentTarget.value
                                        ? e.currentTarget.value.split("\n")
                                        : [],
                                })
                            }}
                        />
                    </div>
                </div>
                <Checkbox.Label
                    htmlFor={`${fieldId}-encrypted`}
                    aria-disabled={!payload}
                >
                    <Checkbox.Input
                        id={`${fieldId}-encrypted`}
                        type="checkbox"
                        disabled={!payload}
                        checked={itemDetails.encrypted}
                        onChange={(e) =>
                            payload &&
                            updateItem({
                                ...itemDetails,
                                payload,
                                encrypted: e.target.checked,
                            })
                        }
                    />
                    <span>Require explicit decryption</span>
                </Checkbox.Label>
            </Card.Body>
            {payloadView}
        </Card>
    )
}

type ItemPayloadProps = {
    payload: VaultItemPayload
    onUpdate: (payload: VaultItemPayload) => void
}

const ItemPayload: FC<ItemPayloadProps> = ({ payload, onUpdate }) => {
    const fieldId = useId()
    const updateField = (newField: VaultItemField) => {
        onUpdate({
            ...payload,
            fields: payload.fields.map((f) =>
                f.uuid === newField.uuid ? newField : f
            ),
        })
    }
    const deleteField = (oldField: VaultItemField) => {
        onUpdate({
            ...payload,
            fields: payload.fields.filter((f) => f.uuid !== oldField.uuid),
        })
    }
    const addField = () => {
        onUpdate({
            ...payload,
            fields: [
                ...payload.fields,
                {
                    uuid: crypto.randomUUID(),
                    name: "Password",
                    value: "",
                    autofillMode: { id: "password" },
                },
            ],
        })
    }
    const reorderFields = (sourceIndex: number, destIndex: number) => {
        const newFields = [...payload.fields]
        const [movedField] = newFields.splice(sourceIndex, 1)
        newFields.splice(destIndex, 0, movedField)
        onUpdate({
            ...payload,
            fields: newFields,
        })
    }
    const fieldViews = payload.fields.map((field, index) => (
        <Field
            index={index}
            key={field.uuid}
            field={field}
            onUpdate={updateField}
            onDelete={deleteField}
        />
    ))
    return (
        <>
            <Card.Body className="grid gap-4">
                <div>
                    <Label htmlFor={`${fieldId}-loginUrl`}>Login URL</Label>
                    <div className="relative mt-2 rounded-md shadow-sm">
                        <Input
                            type="text"
                            id={`${fieldId}-loginUrl`}
                            value={payload.login_url || ""}
                            onChange={(e) => {
                                const login_url =
                                    e.currentTarget.value || undefined
                                const restrict_url = login_url
                                    ? payload.restrict_url
                                    : undefined
                                onUpdate({
                                    ...payload,
                                    login_url,
                                    restrict_url,
                                })
                            }}
                        />
                    </div>
                </div>
                <Checkbox.Label
                    htmlFor={`${fieldId}-restrictUrl`}
                    aria-disabled={!payload.login_url}
                >
                    <Checkbox.Input
                        id={`${fieldId}-restrictUrl`}
                        type="checkbox"
                        disabled={!payload.login_url}
                        checked={!!payload.restrict_url}
                        onChange={(e) => {
                            const restrict_url = e.target.checked || undefined
                            onUpdate({ ...payload, restrict_url })
                        }}
                    />
                    <span>Restrict to login URL</span>
                </Checkbox.Label>
            </Card.Body>
            <Card.Body className="grid gap-5">
                {fieldViews.length > 0 && (
                    <ReorderableList
                        onReorder={reorderFields}
                        className="-mt-4"
                    >
                        {fieldViews}
                    </ReorderableList>
                )}
                <div>
                    <TextButton onClick={addField}>
                        <ButtonIcon icon={PlusIcon} />
                        <span>Add new field</span>
                    </TextButton>
                </div>
            </Card.Body>
        </>
    )
}

type LockedItemProps = {
    vaultId: string
    itemId: string
    onUnlock: (payload: VaultItemPayload) => void
}

const LockedItem: FC<LockedItemProps> = ({ vaultId, itemId, onUnlock }) => {
    const [decryptingItem, decryptItem] = usePromiseState(async () => {
        const decryptedPayload = await sendMessage({
            id: "decryptVaultItem",
            vaultId,
            itemId,
        })
        if (!decryptedPayload) {
            throw new Error("Failed to decrypt item")
        }
        onUnlock(decryptedPayload)
    }, [])
    const decryptItemError = decryptingItem.lastError ? (
        <Status level="danger" colorText={true}>
            {decryptingItem.lastError.toString()}
        </Status>
    ) : null
    return (
        <Card.Body className="bg-[repeating-linear-gradient(135deg,#ffffff,#ffffff_20px,rgb(229_231_235)_20px,rgb(229_231_235)_40px)]">
            {decryptItemError}
            <div className="mx-auto w-fit">
                <PrimaryButton onClick={decryptItem}>
                    <ButtonIcon
                        icon={decryptingItem.inProgress ? Loader : LockOpenIcon}
                    />
                    <span>Decrypt Item</span>
                </PrimaryButton>
            </div>
        </Card.Body>
    )
}
