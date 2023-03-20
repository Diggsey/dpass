import { FC } from "react"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { sendMessage } from "~/entries/shared/messages"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { cn, usePromiseState } from "~/entries/shared/ui"
import { generateRandomWords } from "~/entries/shared/wordlist"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const IdentityStoragePanel: FC<{
    state: PrivilegedState
}> = ({ state }) => {
    const identityWarning = !state.hasIdentity && (
        <div className="panel-block">
            <Status level="warning">No identity found</Status>
        </div>
    )

    const [creatingIdentity, createIdentity] = usePromiseState(async () => {
        const masterPassword = prompt(
            "Enter master password (8 character minimum):"
        )
        if (masterPassword === null) {
            return
        }
        if (masterPassword.length < 8) {
            throw new Error("Master password must be least 8 characters.")
        }
        const words = await generateRandomWords(3)
        let secretSentence: string | null = ""
        do {
            secretSentence = prompt(
                `Enter a memorable sentence using the words "${words[0]}", "${words[1]}" and "${words[2]}":`,
                secretSentence
            )
            if (secretSentence === null) {
                return
            }
        } while (
            !words.every((word) =>
                (secretSentence || "")
                    .toLowerCase()
                    .includes(word.toLowerCase())
            )
        )
        await sendMessage({
            id: "createRoot",
            masterPassword,
            secretSentence,
        })
    }, [])

    const quickSetup = async () => {
        await sendMessage({
            id: "editStorageAddresses",
            vaultId: null,
            action: {
                id: "add",
                storageAddress: {
                    id: "local",
                    folderName: "default",
                },
            },
        })
        await sendMessage({
            id: "createRoot",
            masterPassword: "password",
            secretSentence: "goliath slashed overload",
        })
        const vaultId = await sendMessage({
            id: "createVault",
            name: "Personal Vault",
        })
        if (vaultId === undefined) {
            console.error("Failed to create vault")
            return
        }
        await sendMessage({
            id: "editStorageAddresses",
            vaultId,
            action: {
                id: "add",
                storageAddress: {
                    id: "local",
                    folderName: "default",
                },
            },
        })
        await sendMessage({
            id: "createVaultItem",
            vaultId,
            details: {
                origins: ["https://accounts.google.com"],
                name: "Google",
                encrypted: false,
                payload: {
                    fields: [
                        {
                            uuid: crypto.randomUUID(),
                            name: "Username",
                            autofillMode: {
                                id: "username",
                            },
                            value: "foobar",
                        },
                        {
                            uuid: crypto.randomUUID(),
                            name: "Password",
                            autofillMode: {
                                id: "password",
                            },
                            value: "testpassword",
                        },
                    ],
                },
            },
        })
    }

    const createIdentityError = creatingIdentity.lastError ? (
        <Status level="danger" colorText={true}>
            {creatingIdentity.lastError.toString()}
        </Status>
    ) : null

    return (
        <div className="divide-y divide-gray-200 overflow-hidden sm:rounded-lg bg-white shadow">
            <div className="px-4 py-5 sm:px-6">
                <div className="-ml-4 -mt-2 flex flex-wrap items-center justify-between sm:flex-nowrap">
                    <div className="ml-4 mt-2">
                        <h3 className="text-base font-semibold leading-6 text-gray-900">
                            Where is my identity stored?
                        </h3>
                    </div>
                    <div className="ml-4 mt-2 flex-shrink-0">
                        <button
                            type="button"
                            className="relative inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        >
                            Add storage
                        </button>
                    </div>
                </div>
            </div>
            <div>
                <StorageAddresses
                    vaultId={null}
                    addresses={state.rootAddresses}
                    syncState={state.syncState}
                />
                {identityWarning}
            </div>
            <div className="px-4 py-4 sm:px-6">
                <div className="panel-block is-flex-direction-column is-align-items-start gap-1">
                    <StorageButtons vaultId={null} />
                    <IconButton
                        className={cn({
                            isLoading: creatingIdentity.inProgress,
                            isPrimary: true,
                        })}
                        iconClass="fas fa-user-plus"
                        disabled={
                            state.hasIdentity ||
                            state.rootAddresses.length === 0
                        }
                        onClick={createIdentity}
                    >
                        New Identity
                    </IconButton>
                    {createIdentityError}
                    <IconButton
                        iconClass="fas fa-wand-magic"
                        disabled={
                            state.hasIdentity ||
                            state.rootAddresses.length !== 0
                        }
                        onClick={quickSetup}
                    >
                        Quick Setup
                    </IconButton>
                </div>
            </div>
        </div>
    )
}
