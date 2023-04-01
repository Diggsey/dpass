import { useCallback, useId } from "react"
import { LocalStorageAddress } from "~/entries/shared/privileged/state"
import { StorageEditorProps } from "."

export const LocalStorageEditor = ({
    value: { address },
    onChange,
    disabled,
}: StorageEditorProps<LocalStorageAddress>) => {
    const id = useId()
    const changeFolderName = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange({
                address: { ...address, folderName: e.currentTarget.value },
                canSave: true,
            })
        },
        [address, onChange]
    )
    return (
        <div>
            <label
                htmlFor={id}
                className="block text-sm font-medium leading-6 text-gray-900"
            >
                Folder Name
            </label>
            <div className="mt-2">
                <input
                    type="text"
                    id={id}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={address.folderName}
                    onChange={changeFolderName}
                    disabled={disabled}
                />
            </div>
            <p className="mt-2 text-sm text-gray-500">
                Name of the folder where data will be stored.
            </p>
        </div>
    )
}
