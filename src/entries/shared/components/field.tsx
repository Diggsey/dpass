import { FunctionalComponent } from "preact"
import {
    AutofillMode,
    defaultName,
    PRESET_AUTOFILL_MAPPING,
    PRESET_AUTOFILL_VALUES,
} from "~/entries/shared/autofill"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import { VaultItemField } from "~/entries/shared/state"

type FieldProps = {
    field: VaultItemField
    onUpdate: (field: VaultItemField) => void
    onDelete: (field: VaultItemField) => void
}

export const Field: FunctionalComponent<FieldProps> = ({
    field,
    onUpdate,
    onDelete,
}) => {
    const setAutofillMode = (mode: string) => {
        let autofillMode: AutofillMode
        const id = PRESET_AUTOFILL_VALUES.find((x) => x === mode)
        if (id) {
            autofillMode = {
                id,
            }
        } else if (id === "custom") {
            autofillMode = {
                id,
                key:
                    field.autofillMode.id === "custom"
                        ? field.autofillMode.key
                        : "",
            }
        } else {
            throw new Error("Invalid autofill mode")
        }
        let name = field.name
        if (name === defaultName(field.autofillMode)) {
            name = defaultName(autofillMode)
        }
        onUpdate({
            ...field,
            name,
            autofillMode,
        })
    }
    let valueView
    switch (field.autofillMode.id) {
        case "password":
        case "passwordNote":
            valueView = (
                <PasswordInput
                    class="is-expanded"
                    placeholder="Password"
                    value={field.value}
                    onInput={(e) =>
                        onUpdate({ ...field, value: e.currentTarget.value })
                    }
                />
            )
            break
        default:
            valueView = (
                <div class="control is-expanded">
                    <input
                        class="input"
                        type="text"
                        placeholder="Value"
                        value={field.value}
                        onInput={(e) =>
                            onUpdate({ ...field, value: e.currentTarget.value })
                        }
                    />
                </div>
            )
    }
    return (
        <div class="my-3 p-3 has-background-light">
            <div class="field has-addons">
                <div class="control is-expanded">
                    <input
                        class="input"
                        type="text"
                        placeholder="Name"
                        value={field.name}
                        onInput={(e) =>
                            onUpdate({ ...field, name: e.currentTarget.value })
                        }
                    />
                </div>
                <div class="control">
                    <div class="select">
                        <select
                            value={field.autofillMode.id}
                            onChange={(e) =>
                                setAutofillMode(e.currentTarget.value)
                            }
                        >
                            {PRESET_AUTOFILL_VALUES.map((id) => (
                                <option value={id}>
                                    {PRESET_AUTOFILL_MAPPING[id].name}
                                </option>
                            ))}
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                </div>
            </div>
            {field.autofillMode.id === "custom" ? (
                <div class="field">
                    <div class="control">
                        <input
                            class="input"
                            type="text"
                            placeholder="Custom type"
                            value={field.autofillMode.key}
                            onInput={(e) =>
                                onUpdate({
                                    ...field,
                                    autofillMode: {
                                        id: "custom",
                                        key: e.currentTarget.value,
                                    },
                                })
                            }
                        />
                    </div>
                </div>
            ) : null}
            <div class="field is-grouped">
                {valueView}
                <button
                    class="delete is-large is-align-self-center"
                    onClick={() => onDelete(field)}
                />
            </div>
        </div>
    )
}
