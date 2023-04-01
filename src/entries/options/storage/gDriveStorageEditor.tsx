import {
    CheckCircleIcon,
    ExclamationCircleIcon,
} from "@heroicons/react/24/outline"
import { ChangeEvent, useCallback, useId, useState } from "react"
import { Loader } from "~/entries/shared/components/loader"
import { GDriveStorageAddress } from "~/entries/shared/privileged/state"
import { TOKEN_MANAGER } from "~/entries/shared/tokens"
import { cn } from "~/entries/shared/ui"
import { usePromiseState } from "~/entries/shared/ui/hooks"
import { StorageEditorProps } from "."

function generateSharingUrl(address: GDriveStorageAddress) {
    return address.folderId
        ? `https://drive.google.com/drive/folders/${address.folderId}?usp=share_link`
        : ""
}

async function importSharingUrl(url: string): Promise<GDriveStorageAddress> {
    const folderLocation = new URL(url).pathname
    const folderId = folderLocation.split("/").pop()
    if (!folderId) {
        throw new Error("Invalid sharing URL")
    }
    const [_token, connectionInfo] = await TOKEN_MANAGER.request({
        id: "oauth",
        serverId: "google",
        userId: "",
    })
    if (connectionInfo.id !== "oauth") {
        throw new Error("Expected connection type to be Oauth")
    }
    return {
        id: "gdrive",
        folderId,
        userId: connectionInfo.userId,
    }
}

export const GDriveStorageEditor = ({
    value: { address, canSave },
    onChange,
    disabled,
}: StorageEditorProps<GDriveStorageAddress>) => {
    const id = useId()
    const [sharingUrl, setSharingUrl] = useState(() =>
        generateSharingUrl(address)
    )
    const changeSharingUrl = useCallback(
        (e: ChangeEvent<HTMLInputElement>) => {
            setSharingUrl(e.currentTarget.value)
            if (canSave) {
                onChange({ address, canSave: false })
            }
        },
        [address, canSave]
    )
    const [committingSharingUrl, commitSharingUrl] =
        usePromiseState(async () => {
            if (canSave) {
                return
            }
            const newAddress = await importSharingUrl(sharingUrl)
            onChange({
                address: newAddress,
                canSave: true,
            })
        }, [sharingUrl, address, onChange])
    const isValid =
        address.folderId && address.userId && !committingSharingUrl.lastError

    return (
        <div>
            <label
                htmlFor={id}
                className="block text-sm font-medium leading-6 text-gray-900"
            >
                Folder Sharing URL
            </label>
            <div className="relative mt-2 rounded-md shadow-sm">
                <input
                    type="text"
                    id={id}
                    className={cn(
                        "block w-full rounded-md border-0 py-1.5 pr-10 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6",

                        isValid
                            ? "text-gray-900 ring-gray-300 placeholder:text-gray-400 focus:ring-indigo-600"
                            : "text-red-900 ring-red-300 placeholder:text-red-300 focus:ring-red-500"
                    )}
                    value={sharingUrl}
                    onChange={changeSharingUrl}
                    onBlur={() => {
                        void commitSharingUrl()
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            void commitSharingUrl()
                        }
                    }}
                    disabled={disabled}
                    aria-invalid={!isValid}
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    {!isValid ? (
                        <ExclamationCircleIcon
                            className="h-5 w-5 text-red-500"
                            aria-hidden="true"
                        />
                    ) : committingSharingUrl.inProgress ? (
                        <Loader
                            className="h-5 w-5 text-gray-500"
                            aria-hidden="true"
                        />
                    ) : (
                        <CheckCircleIcon
                            className="h-5 w-5 text-green-500"
                            aria-hidden="true"
                        />
                    )}
                </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
                Sharing URL for a{" "}
                <a
                    href="https://drive.google.com"
                    rel="noopener noreferrer"
                    target="_blank"
                    className="underline"
                >
                    Google Drive
                </a>{" "}
                folder where data will be stored.
            </p>
            {committingSharingUrl.lastError ? (
                <p className="mt-2 text-sm text-red-600" id="email-error">
                    Not a valid sharing URL.
                </p>
            ) : null}
        </div>
    )
}
