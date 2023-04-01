import { RadioGroup } from "@headlessui/react"
import { CheckCircleIcon } from "@heroicons/react/24/outline"
import { cn } from "~/entries/shared/ui"
import { StorageAddressType, STORAGE_PROVIDERS } from "."

type StorageTypePickerProps = {
    value: StorageAddressType
    onChange: (newValue: StorageAddressType) => void
    disabled?: boolean
}

export const StorageTypePicker = ({
    value,
    onChange,
    disabled,
}: StorageTypePickerProps) => {
    return (
        <RadioGroup value={value} onChange={onChange} disabled={disabled}>
            <RadioGroup.Label className="text-base font-semibold leading-6 text-gray-900">
                Select a storage provider
            </RadioGroup.Label>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {STORAGE_PROVIDERS.map((p) => (
                    <RadioGroup.Option
                        key={p.initial.id}
                        value={p.initial.id}
                        className={({ checked, active }) =>
                            cn(
                                checked
                                    ? "border-transparent"
                                    : "border-gray-300",
                                active
                                    ? "border-indigo-600 ring-2 ring-indigo-600"
                                    : "",
                                "relative flex cursor-pointer rounded-lg border bg-white p-4 gap-4 shadow-sm focus:outline-none"
                            )
                        }
                    >
                        {({ checked, active }) => (
                            <>
                                <img
                                    className="h-12 w-12"
                                    src={p.icon}
                                    alt=""
                                />
                                <span className="flex flex-1 flex-col">
                                    <RadioGroup.Label
                                        as="span"
                                        className="block text-sm font-medium text-gray-900"
                                    >
                                        {p.name}
                                    </RadioGroup.Label>
                                    <RadioGroup.Description
                                        as="span"
                                        className="mt-1 flex items-center text-sm text-gray-500"
                                    >
                                        {p.description}
                                    </RadioGroup.Description>
                                </span>
                                <CheckCircleIcon
                                    className={cn(
                                        !checked ? "invisible" : "",
                                        "h-5 w-5 text-indigo-600"
                                    )}
                                    aria-hidden="true"
                                />
                                <span
                                    className={cn(
                                        active ? "border" : "border-2",
                                        checked
                                            ? "border-indigo-600"
                                            : "border-transparent",
                                        "pointer-events-none absolute -inset-px rounded-lg"
                                    )}
                                    aria-hidden="true"
                                />
                            </>
                        )}
                    </RadioGroup.Option>
                ))}
            </div>
        </RadioGroup>
    )
}
