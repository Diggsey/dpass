import { FunctionalComponent } from "preact"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import { AutofillMode, VaultItemField } from "~/entries/shared/state"

type FieldProps = {
    field: VaultItemField,
    onUpdate: (field: VaultItemField) => void,
    onDelete: (field: VaultItemField) => void,
}

export const Field: FunctionalComponent<FieldProps> = ({ field, onUpdate, onDelete }) => {
    const setAutofillMode = (id: string) => {
        let autofillMode: AutofillMode
        switch (id) {
            case "username":
            case "email":
            case "password":
            case "text":
                autofillMode = { id }
                break
            case "custom":
                autofillMode = {
                    id,
                    key: field.autofillMode.id === "custom" ? field.autofillMode.key : ""
                }
                break
            default:
                throw new Error("Invalid autofill mode")
        }
        onUpdate({
            ...field,
            autofillMode,
        })
    }
    let valueView
    switch (field.autofillMode.id) {
        case "password":
            valueView = <PasswordInput
                class="is-expanded"
                placeholder="Password"
                value={field.value}
                onInput={e => onUpdate({ ...field, value: e.currentTarget.value })}
            />
            break
        default:
            valueView = <div class="control is-expanded">
                <input
                    class="input"
                    type="text"
                    placeholder="Value"
                    value={field.value}
                    onInput={e => onUpdate({ ...field, value: e.currentTarget.value })}
                />
            </div>
    }
    return <>
        <div class="field has-addons">
            <div class="control is-expanded">
                <input
                    class="input"
                    type="text"
                    placeholder="Name"
                    value={field.name}
                    onInput={e => onUpdate({ ...field, name: e.currentTarget.value })}
                />
            </div>
            <div class="control">
                <div class="select">
                    <select value={field.autofillMode.id} onChange={e => setAutofillMode(e.currentTarget.value)}>
                        <option value="username">Username</option>
                        <option value="email">Email</option>
                        <option value="password">Password</option>
                        <option value="text">Text</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>
            </div>
        </div>
        {field.autofillMode.id === "custom" ?
            <div class="field">
                <div class="control">
                    <input
                        class="input"
                        type="text"
                        placeholder="Custom type"
                        value={field.autofillMode.key}
                        onInput={e => onUpdate({ ...field, autofillMode: { id: "custom", key: e.currentTarget.value } })}
                    />
                </div>
            </div> : null
        }
        <div class="field is-grouped">
            {valueView}
            <button class="delete is-large is-align-self-center" onClick={() => onDelete(field)} />
        </div>
    </>
}