import { FunctionalComponent } from "preact"
import { IconButton } from "~/entries/shared/components/iconButton"
import { Status } from "~/entries/shared/components/status"
import { sendMessage } from "~/entries/shared/messages"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { cn, usePromiseState } from "~/entries/shared/ui"
import { generateRandomWords } from "~/entries/shared/wordlist"
import { StorageAddresses } from "../storage/addresses"
import { StorageButtons } from "../storage/buttons"

export const IdentityStoragePanel: FunctionalComponent<{
    state: PrivilegedState
}> = ({ state }) => {
    const panelClass = cn("panel", {
        isDanger: !state.hasIdentity || state.rootAddresses.length === 0,
    })

    const identityWarning = !state.hasIdentity && (
        <div class="panel-block">
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

    const createIdentityError = creatingIdentity.lastError && (
        <Status level="danger" colorText={true}>
            {creatingIdentity.lastError.toString()}
        </Status>
    )

    return (
        <article class={panelClass}>
            <p class="panel-heading">Storage</p>
            <StorageAddresses
                vaultId={null}
                addresses={state.rootAddresses}
                syncState={state.syncState}
            />
            {identityWarning}
            <div class="panel-block is-flex-direction-column is-align-items-start gap-1">
                <StorageButtons vaultId={null} />
                <IconButton
                    class={cn({
                        isLoading: creatingIdentity.inProgress,
                        isPrimary: true,
                    })}
                    iconClass="fas fa-user-plus"
                    disabled={
                        state.hasIdentity || state.rootAddresses.length === 0
                    }
                    onClick={createIdentity}
                >
                    New Identity
                </IconButton>
                {createIdentityError}
                <IconButton
                    iconClass="fas fa-wand-magic"
                    disabled={
                        state.hasIdentity || state.rootAddresses.length !== 0
                    }
                    onClick={quickSetup}
                >
                    Quick Setup
                </IconButton>
            </div>
        </article>
    )
}
