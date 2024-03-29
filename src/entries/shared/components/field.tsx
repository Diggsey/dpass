import { ArrowsUpDownIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { FC, ReactNode, useCallback } from "react"
import {
    AutofillMode,
    defaultName,
    PRESET_AUTOFILL_MAPPING,
    PRESET_AUTOFILL_VALUES,
} from "~/entries/shared/autofill"
import { PasswordInput } from "~/entries/shared/components/passwordInput"
import { VaultItemField } from "~/entries/shared/state"
import { AutoTextArea } from "./autoTextArea"
import { ButtonIcon } from "./buttonIcon"
import { ReorderableItem } from "./reorderableList"
import { Input, Select, TextButton } from "./styledElem"
import host from "~/entries/shared/host"

type FieldProps = {
    index: number
    field: VaultItemField
    onUpdate: (field: VaultItemField) => void
    onDelete: (field: VaultItemField) => void
}

export const Field: FC<FieldProps> = ({ field, index, onUpdate, onDelete }) => {
    const isMultiLine = field.value.includes("\n")
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
    const copy = useCallback(async () => {
        await host.copyText(field.value)
    }, [field.value])

    const generatePassword = useCallback(async () => {
        const password = await host.sendMessage({ id: "generatePassword" })
        if (password !== undefined) {
            onUpdate({ ...field, value: password })
        }
    }, [field])

    let valueView: ReactNode
    switch (field.autofillMode.id) {
        case "password":
        case "passwordNote":
            valueView = (
                <PasswordInput
                    className="is-expanded"
                    placeholder="Password"
                    value={field.value}
                    onChange={(e) =>
                        onUpdate({ ...field, value: e.currentTarget.value })
                    }
                />
            )
            break
        case "note":
            valueView = (
                <div className="relative mt-2 rounded-md shadow-sm">
                    <AutoTextArea
                        placeholder="Value"
                        value={field.value}
                        onChange={(e) =>
                            onUpdate({ ...field, value: e.currentTarget.value })
                        }
                    />
                </div>
            )
            break
        default:
            valueView = (
                <div className="relative mt-2 rounded-md shadow-sm">
                    <Input
                        type="text"
                        placeholder="Value"
                        value={field.value}
                        onChange={(e) =>
                            onUpdate({ ...field, value: e.currentTarget.value })
                        }
                    />
                </div>
            )
    }

    return (
        <ReorderableItem index={index} className="mt-4">
            {(dragHandleProps) => (
                <div className="flex gap-3 items-center">
                    <div
                        className="shrink-0 text-gray-900"
                        {...dragHandleProps}
                    >
                        <ArrowsUpDownIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between">
                            <Input
                                className="!ring-0 hover:bg-gray-100 !p-0 !shadow-none font-medium !min-w-[150px] max-w-sm"
                                type="text"
                                placeholder="Name"
                                value={field.name}
                                onChange={(e) =>
                                    onUpdate({
                                        ...field,
                                        name: e.currentTarget.value,
                                    })
                                }
                            />
                            <Select
                                className="!ring-0 hover:bg-gray-100 !py-0 !shadow-none font-medium text-right w-min !text-indigo-600 !text-xs !pr-5 !bg-right"
                                value={field.autofillMode.id}
                                onChange={(e) =>
                                    setAutofillMode(e.currentTarget.value)
                                }
                            >
                                {PRESET_AUTOFILL_VALUES.map((id) => (
                                    <option
                                        className="text-gray-900 bg-white disabled:text-gray-500"
                                        value={id}
                                        disabled={
                                            isMultiLine &&
                                            !PRESET_AUTOFILL_MAPPING[id]
                                                .multiLine
                                        }
                                    >
                                        {PRESET_AUTOFILL_MAPPING[id].name}
                                    </option>
                                ))}
                                <option
                                    className="text-gray-900 bg-white disabled:text-gray-500"
                                    value="custom"
                                >
                                    Custom
                                </option>
                            </Select>
                        </div>
                        {field.autofillMode.id === "custom" ? (
                            <Input
                                type="text"
                                placeholder="Custom type"
                                value={field.autofillMode.key}
                                onChange={(e) =>
                                    onUpdate({
                                        ...field,
                                        autofillMode: {
                                            id: "custom",
                                            key: e.currentTarget.value,
                                        },
                                    })
                                }
                            />
                        ) : null}
                        <div className="field is-grouped">
                            {valueView}
                            <div className="flex gap-3 mt-1">
                                {!field.value &&
                                    ["password", "passwordNote"].includes(
                                        field.autofillMode.id
                                    ) && (
                                        <TextButton
                                            className="text-xs"
                                            onClick={generatePassword}
                                        >
                                            Generate New...
                                        </TextButton>
                                    )}
                                <TextButton
                                    className="text-xs ml-auto"
                                    onClick={copy}
                                >
                                    Copy
                                </TextButton>
                            </div>
                        </div>
                    </div>
                    <TextButton
                        className="shrink-0"
                        onClick={() => onDelete(field)}
                    >
                        <ButtonIcon icon={XMarkIcon} />
                    </TextButton>
                </div>
            )}
        </ReorderableItem>
    )
}
