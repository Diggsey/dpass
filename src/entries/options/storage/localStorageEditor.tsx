import { useCallback, useId } from "react"
import { LocalStorageAddress } from "~/entries/shared/privileged/state"
import { StorageEditorProps } from "."
import { Input } from "~/entries/shared/components/styledElem"

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
                <Input
                    type="text"
                    id={id}
                    value={address.folderName}
                    onChange={changeFolderName}
                    disabled={disabled}
                    autoFocus
                />
            </div>
            <p className="mt-2 text-sm text-gray-500">
                Name of the folder where data will be stored.
            </p>
        </div>
    )
}
