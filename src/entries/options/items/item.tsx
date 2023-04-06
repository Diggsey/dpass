import { FC, useEffect, useState } from "react"
import { sendMessage } from "~/entries/shared/messages"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import {
    VaultItem,
    VaultItemField,
    VaultItemPayload,
} from "~/entries/shared/state"
import { cn } from "~/entries/shared/ui"
import { Field } from "../../shared/components/field"
import { ItemDetails } from "~/entries/shared/messages/vault"
import {
    usePromiseState,
    useSharedPromiseState,
} from "~/entries/shared/ui/hooks"
import { Card } from "~/entries/shared/components/styledElem"

type ItemProps = {
    vaultId: string
    itemId: string
    item: VaultItem
}

export const Item: FC<ItemProps> = ({ vaultId, itemId, item }) => {
    const itemAction = useSharedPromiseState()

    // Not-null if there are local (unsaved) changes to the item.
    // Local payload changes are only stored here if the item is not encrypted.
    const [editedDetails, setEditedDetails] = useState<ItemDetails | null>(null)

    // Not-null if the item is encrypted, but has been temporarily decrypted for editing.
    // Local changes are also made here if the item is encrypted.
    const [decryptedPayload, setDecryptedPayload] =
        useState<VaultItemPayload | null>(null)

    // Used to initiate an update to the item
    const [updatingItem, updateItem] = usePromiseState(
        async (details: ItemDetails) => {
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

    useEffect(() => {
        // If the latest asynchronous vault update is done then our local changes can
        // be discarded.
        if (!updatingItem.inProgress && editedDetails) {
            setEditedDetails(null)
        }
    }, [updatingItem.inProgress, editedDetails])

    // Create a local view of the item, including any unsaved edits
    const itemDetails: ItemDetails = editedDetails || {
        name: item.name,
        origins: item.origins,
        encrypted: item.data.encrypted,
        payload: item.data.encrypted ? undefined : item.data.payload,
    }

    // If the item becomes encrypted, clear the decrypted payload until
    // it is explicitly decrypted.
    // If the item becomes decrypted, clear the decrypted payload because
    // the payload will no longer be stored there.
    useEffect(() => {
        setDecryptedPayload(null)
    }, [itemDetails.encrypted])

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
            <Card.Header>
                <div className="is-flex is-flex-direction-row is-justify-content-end gap-1">
                    <IconButton
                        iconClass={cn("fas fa-trash-can", {
                            isLoading: deletingItem.inProgress,
                        })}
                        disabled={itemAction.inProgress}
                        onClick={deleteItem}
                    >
                        Delete
                    </IconButton>
                </div>
            </Card.Header>
            <Card.Body>
                <div className="field">
                    <label className="label">Name</label>
                    <div className="control">
                        <input
                            className="input"
                            type="text"
                            value={itemDetails.name}
                            onChange={(e) =>
                                updateItem({
                                    ...itemDetails,
                                    name: e.currentTarget.value,
                                })
                            }
                        />
                    </div>
                </div>
                <div className="field">
                    <label className="label">Origins</label>
                </div>

                {itemDetails.origins.map((origin, i) => (
                    <div className="field is-grouped">
                        <div key={i} className="control is-expanded">
                            <input
                                className="input"
                                type="text"
                                placeholder="example.com"
                                value={origin}
                                onChange={(e) =>
                                    updateItem({
                                        ...itemDetails,
                                        origins: itemDetails.origins.map(
                                            (o, j) =>
                                                i == j
                                                    ? e.currentTarget.value
                                                    : o
                                        ),
                                    })
                                }
                            />
                        </div>
                        <button
                            className="delete is-large is-align-self-center"
                            onClick={() =>
                                updateItem({
                                    ...itemDetails,
                                    origins: [
                                        ...itemDetails.origins.slice(0, i),
                                        ...itemDetails.origins.slice(i + 1),
                                    ],
                                })
                            }
                        />
                    </div>
                ))}
                <div className="field">
                    <div className="control">
                        <IconButton
                            iconClass="fas fa-plus"
                            onClick={() =>
                                updateItem({
                                    ...itemDetails,
                                    origins: [...itemDetails.origins, ""],
                                })
                            }
                        >
                            Add origin
                        </IconButton>
                    </div>
                </div>
                <div className="field">
                    <div className="control">
                        <label className="checkbox">
                            <input
                                type="checkbox"
                                disabled={!payload}
                                checked={itemDetails.encrypted}
                                onClick={() =>
                                    payload &&
                                    updateItem({
                                        ...itemDetails,
                                        payload,
                                        encrypted: !itemDetails.encrypted,
                                    })
                                }
                            />
                            Encrypted
                        </label>
                    </div>
                </div>
                <hr />
                {payloadView}
            </Card.Body>
        </Card>
    )
}

type ItemPayloadProps = {
    payload: VaultItemPayload
    onUpdate: (payload: VaultItemPayload) => void
}

const ItemPayload: FC<ItemPayloadProps> = ({ payload, onUpdate }) => {
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
    const fieldViews = payload.fields.map((field) => (
        <Field
            key={field.uuid}
            field={field}
            onUpdate={updateField}
            onDelete={deleteField}
        />
    ))
    return (
        <>
            <div className="field">
                <label className="label">Login URL</label>
                <div className="control">
                    <input
                        className="input"
                        type="text"
                        value={payload.login_url || ""}
                        onChange={(e) => {
                            const login_url = e.currentTarget.value || undefined
                            const restrict_url = login_url
                                ? payload.restrict_url
                                : undefined
                            onUpdate({ ...payload, login_url, restrict_url })
                        }}
                    />
                </div>
            </div>
            <div className="field">
                <div className="control">
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            disabled={!payload.login_url}
                            checked={!!payload.restrict_url}
                            onClick={() => {
                                const restrict_url =
                                    !payload.restrict_url || undefined
                                onUpdate({ ...payload, restrict_url })
                            }}
                        />
                        Restrict to login URL
                    </label>
                </div>
            </div>
            <hr />
            {fieldViews}
            <div className="field">
                <div className="control">
                    <IconButton iconClass="fas fa-plus" onClick={addField}>
                        Add new field
                    </IconButton>
                </div>
            </div>
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
    const decryptButtonClass = cn({
        isLoading: decryptingItem.inProgress,
    })
    return (
        <div>
            {decryptItemError}
            <IconButton
                className={decryptButtonClass}
                iconClass="fas fa-unlock"
                onClick={decryptItem}
            >
                Decrypt Item
            </IconButton>
        </div>
    )
}
