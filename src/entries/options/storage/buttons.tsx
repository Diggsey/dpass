import { FC } from "react"
import host from "~/entries/shared/host"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { cn } from "~/entries/shared/ui"
import { usePromiseState } from "~/entries/shared/ui/hooks"

type StorageButtonsProps = {
    vaultId: string | null
}

export const StorageButtons: FC<StorageButtonsProps> = ({ vaultId }) => {
    const [addingStorage, addStorage] = usePromiseState(
        async (storageAddress: StorageAddress) => {
            await host.sendMessage({
                id: "editStorageAddresses",
                vaultId,
                action: {
                    id: "add",
                    storageAddress,
                },
            })
        },
        []
    )

    const addStorageError = addingStorage.lastError && (
        <Status level="danger" colorText={true}>
            {addingStorage.lastError.toString()}
        </Status>
    )

    const addStorageButtonClass = (id: StorageAddress["id"]) =>
        cn({
            isLoading:
                addingStorage.inProgress && addingStorage.lastArgs[0].id === id,
            isInfo: true,
        })

    const disabledValue = (id: StorageAddress["id"]) =>
        addingStorage.inProgress && addingStorage.lastArgs[0].id !== id

    const addLocalStorage = async () => {
        const folderName = prompt("Enter folder name:", "default")
        if (!folderName) {
            return
        }
        await addStorage({
            id: "local",
            folderName,
        })
    }

    const addGDriveStorage = async () => {
        const folderUrl = prompt(
            "Enter sharing URL for the GDrive folder to use:"
        )
        if (!folderUrl) {
            return
        }
        const folderLocation = new URL(folderUrl).pathname
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
        await addStorage({
            id: "gdrive",
            folderId,
            userId: connectionInfo.userId,
        })
    }

    return (
        <>
            <div className="is-flex is-flex-wrap-wrap gap-1">
                <IconButton
                    className={addStorageButtonClass("local")}
                    iconClass="fas fa-location-dot"
                    disabled={disabledValue("local")}
                    onClick={addLocalStorage}
                >
                    Add Local Storage
                </IconButton>
                <IconButton
                    className={addStorageButtonClass("gdrive")}
                    iconClass="fab fa-google-drive"
                    disabled={disabledValue("gdrive")}
                    onClick={addGDriveStorage}
                >
                    Add GDrive Storage
                </IconButton>
            </div>
            {addStorageError}
        </>
    )
}
