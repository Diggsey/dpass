import { ChangeEvent, useCallback, useId, useState } from "react"
import { InputValidationIcon } from "~/entries/shared/components/inputValidationIcon"
import {
    HelpText,
    Label,
    ValidationError,
} from "~/entries/shared/components/styledElem"
import { GDriveStorageAddress } from "~/entries/shared/privileged/state"
import { usePromiseState } from "~/entries/shared/ui/hooks"
import { StorageEditorProps } from "."
import { FormInput } from "~/entries/shared/components/formInput"
import host from "~/entries/shared/host"

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
    const [_token, connectionInfo] = await host.requestToken({
        id: "oauth",
        serverId: "com.google",
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
        address.folderId.length > 0 &&
        address.userId.length > 0 &&
        !committingSharingUrl.lastError

    return (
        <div>
            <Label htmlFor={id}>Folder Sharing URL</Label>
            <div className="relative mt-2 rounded-md shadow-sm">
                <FormInput
                    type="text"
                    id={id}
                    className="pr-10"
                    value={sharingUrl}
                    onChange={changeSharingUrl}
                    onCommit={() => {
                        void commitSharingUrl()
                    }}
                    disabled={disabled}
                    aria-invalid={!isValid}
                    autoFocus
                />
                <InputValidationIcon
                    valid={isValid}
                    validating={committingSharingUrl.inProgress}
                />
            </div>
            <HelpText>
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
            </HelpText>
            {committingSharingUrl.lastError ? (
                <ValidationError>Not a valid sharing URL.</ValidationError>
            ) : null}
        </div>
    )
}
