import { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ItemDetails, sendMessage } from "~/entries/shared";
import { IconButton } from "~/entries/shared/components/iconButton";
import { Status } from "~/entries/shared/components/status";
import { VaultItem, VaultItemField, VaultItemPayload } from "~/entries/shared/state";
import { cn, usePromiseState } from "~/entries/shared/ui";
import { Field } from "./field";

type ItemProps = {
    vaultId: string,
    itemId: string,
    item: VaultItem,
}

export const Item: FunctionalComponent<ItemProps> = ({ vaultId, itemId, item }) => {
    const [editedDetails, setEditedDetails] = useState<ItemDetails | null>(null)
    const [decryptedPayload, setDecryptedPayload] = useState<VaultItemPayload | null>(null)
    const [updatingItem, updateItem] = usePromiseState(async (details: ItemDetails) => {
        if (details.encrypted) {
            const { payload, ...rest } = details
            setEditedDetails(rest)
            if (payload) {
                setDecryptedPayload(payload)
            }
        } else {
            setEditedDetails(details)
            setDecryptedPayload(null)
        }
        await sendMessage({
            id: "updateVaultItem",
            vaultId,
            itemId,
            details,
        })
    }, [])

    useEffect(() => {
        if (!updatingItem.inProgress && editedDetails) {
            if (editedDetails.encrypted && editedDetails.payload) {
                setDecryptedPayload(editedDetails.payload)
            }
            setEditedDetails(null)
        }
    }, [updatingItem.inProgress, editedDetails])

    const itemDetails: ItemDetails = editedDetails || {
        name: item.name,
        origins: item.origins,
        encrypted: item.data.encrypted,
        payload: item.data.encrypted ? undefined : item.data.payload,
    }

    useEffect(() => {
        setDecryptedPayload(null)
    }, [itemDetails.encrypted])

    const payload = itemDetails.payload || decryptedPayload
    const payloadView = payload
        ? <ItemPayload payload={payload} onUpdate={newPayload => updateItem({ ...itemDetails, payload: newPayload })} />
        : <LockedItem vaultId={vaultId} itemId={itemId} onUnlock={payload => setDecryptedPayload(payload)} />

    return <div class="box">
        <div class="field">
            <label class="label">Name</label>
            <div class="control">
                <input
                    class="input"
                    type="text"
                    value={itemDetails.name}
                    onInput={e => updateItem({ ...itemDetails, name: e.currentTarget.value })}
                />
            </div>
        </div>
        <div class="field">
            <label class="label">Origins</label>
        </div>

        {itemDetails.origins.map((origin, i) => (
            <div class="field is-grouped">
                <div key={i} class="control is-expanded">
                    <input
                        class="input"
                        type="text"
                        placeholder="example.com"
                        value={origin}
                        onInput={e => updateItem({ ...itemDetails, origins: itemDetails.origins.map((o, j) => i == j ? e.currentTarget.value : o) })}
                    />
                </div>
                <button class="delete is-large is-align-self-center" onClick={() => updateItem({ ...itemDetails, origins: [...itemDetails.origins.slice(0, i), ...itemDetails.origins.slice(i + 1)] })} />
            </div>
        ))}
        <div class="field">
            <div class="control">
                <IconButton iconClass="fas fa-plus" onClick={() => updateItem({ ...itemDetails, origins: [...itemDetails.origins, ""] })}>Add origin</IconButton>
            </div>
        </div>
        <div class="field">
            <div class="control">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        disabled={!payload}
                        checked={itemDetails.encrypted}
                        onClick={() => payload && updateItem({ ...itemDetails, payload, encrypted: !itemDetails.encrypted })}
                    />
                    Encrypted
                </label>
            </div>
        </div>
        <hr />
        {payloadView}
    </div >
}

type ItemPayloadProps = {
    payload: VaultItemPayload,
    onUpdate: (payload: VaultItemPayload) => void,
}

const ItemPayload: FunctionalComponent<ItemPayloadProps> = ({ payload, onUpdate }) => {
    const updateField = (newField: VaultItemField) => {
        onUpdate({
            ...payload,
            fields: payload.fields.map(f => (f.uuid === newField.uuid ? newField : f))
        })
    }
    const deleteField = (oldField: VaultItemField) => {
        onUpdate({
            ...payload,
            fields: payload.fields.filter(f => f.uuid !== oldField.uuid)
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
                    autofillMode: { id: "password" }
                }
            ]
        })
    }
    const fieldViews = payload.fields.map(field => (
        <Field key={field.uuid} field={field} onUpdate={updateField} onDelete={deleteField} />
    ))
    return <>
        <div class="field">
            <label class="label">Login URL</label>
            <div class="control">
                <input
                    class="input"
                    type="text"
                    value={payload.login_url || ""}
                    onInput={e => {
                        const login_url = e.currentTarget.value || undefined
                        const restrict_url = login_url ? payload.restrict_url : undefined
                        onUpdate({ ...payload, login_url, restrict_url })
                    }}
                />
            </div>
        </div>
        <div class="field">
            <div class="control">
                <label class="checkbox">
                    <input
                        type="checkbox"
                        disabled={!payload.login_url}
                        checked={!!payload.restrict_url}
                        onClick={() => {
                            const restrict_url = !payload.restrict_url || undefined
                            onUpdate({ ...payload, restrict_url })
                        }}
                    />
                    Restrict to login URL
                </label>
            </div>
        </div>
        <hr />
        {fieldViews}
        <div class="field">
            <div class="control">
                <IconButton iconClass="fas fa-plus" onClick={addField}>Add new field</IconButton>
            </div>
        </div>
    </>
}

type LockedItemProps = {
    vaultId: string,
    itemId: string,
    onUnlock: (payload: VaultItemPayload) => void,
}

const LockedItem: FunctionalComponent<LockedItemProps> = ({ vaultId, itemId, onUnlock }) => {
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
    const decryptItemError = decryptingItem.lastError && <Status level="danger" colorText={true}>{decryptingItem.lastError.toString()}</Status>
    const decryptButtonClass = cn({
        isLoading: decryptingItem.inProgress,
    })
    return <div>
        {decryptItemError}
        <IconButton class={decryptButtonClass} iconClass="fas fa-unlock" onClick={decryptItem}>
            Decrypt Item
        </IconButton>
    </div>
}