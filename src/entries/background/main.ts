import {
    PRIVILEGED_PORT_NAME,
    StorageAddress,
} from "../shared/privileged/state"
import { UNPRIVILEGED_PORT_NAME } from "../shared/state"
import { SECURE_CONTEXT } from "./context"
import { PrivilegedPublisher } from "./pubsub/privileged"
import { UnprivilegedPublisher } from "./pubsub/unprivileged"
import "./commands"
import { Message, MessageResponse } from "../shared/messages"
import { AutofillPayload } from "../shared/messages/autofill"
import { doesLoginUrlMatch, objectKey } from "../shared"
import { StorageAddressAction } from "../shared/messages/storage"
import { FrameDetails, OptionsPageTarget } from "../shared/messages/misc"
import { setLocalState } from "../shared/ui/hooks"
import { STORAGE_MANAGER } from "./storage/connection"
import { ROOT_FILE_ID } from "./context/rootContext"
import { runInitializers } from "./init"
import host, { Port, SenderType } from "~/entries/shared/host"

if (!host.isTrusted) {
    throw new Error(
        `Background script was loaded in an unprivileged context (${location.protocol})`
    )
}

const unprivilegedMessages = [
    "requestAutofill",
    "getFrameDetails",
    "openOptionsPage",
]

function castVoidPromise(x: Promise<void>): Promise<undefined> {
    return x as Promise<undefined>
}

function handleMessage(
    message: Message,
    senderType: SenderType,
    frameDetails?: FrameDetails | undefined
): Promise<MessageResponse> | undefined {
    if (
        senderType.id !== "privileged" &&
        !unprivilegedMessages.includes(message.id)
    ) {
        return undefined
    }
    switch (message.id) {
        case "requestAutofill":
            return requestAutoFill(senderType, message.vaultId, message.itemId)
        case "createRoot":
            return castVoidPromise(
                SECURE_CONTEXT.createRoot(
                    message.name,
                    message.masterPassword,
                    message.secretSentence
                )
            )
        case "editRootName":
            return castVoidPromise(SECURE_CONTEXT.updateRootName(message.name))
        case "editStorageAddresses":
            return editStorageAddresses(message.vaultId, message.action)
        case "unlock":
            return castVoidPromise(
                SECURE_CONTEXT.unlock(
                    message.masterPassword,
                    message.secretSentence
                )
            )
        case "lock":
            return castVoidPromise(SECURE_CONTEXT.lock(message.unenroll))
        case "changeRootPassword":
            return castVoidPromise(
                SECURE_CONTEXT.changePassword(
                    message.oldPassword,
                    message.newPassword ?? null,
                    message.newSentence ?? null
                )
            )
        case "createVault":
            return SECURE_CONTEXT.createVault(message.name, message.copyStorage)
        case "removeVault":
            return castVoidPromise(SECURE_CONTEXT.removeVault(message.vaultId))
        case "setVaultAsDefault":
            return castVoidPromise(
                SECURE_CONTEXT.setVaultAsDefault(message.vaultId)
            )
        case "clearHistory":
            return castVoidPromise(SECURE_CONTEXT.clearHistory())
        case "editVaultName":
            return castVoidPromise(
                SECURE_CONTEXT.updateVaultName(message.vaultId, message.name)
            )
        case "createVaultItem":
            return SECURE_CONTEXT.createVaultItem(
                message.vaultId,
                message.details
            )
        case "updateVaultItem":
            return castVoidPromise(
                SECURE_CONTEXT.updateVaultItem(
                    message.vaultId,
                    message.itemId,
                    message.details
                )
            )
        case "deleteVaultItem":
            return castVoidPromise(
                SECURE_CONTEXT.deleteVaultItem(message.vaultId, message.itemId)
            )
        case "decryptVaultItem":
            return SECURE_CONTEXT.decryptVaultItem(
                message.vaultId,
                message.itemId
            )
        case "getFrameDetails":
            return Promise.resolve(frameDetails)
        case "forward":
            return host.sendMessageToFrame(
                message.tabId,
                message.frameId,
                message.message
            )
        case "openOptionsPage":
            return castVoidPromise(openOptionsPage(message.target))
        case "editGeneratorSettings":
            return castVoidPromise(
                SECURE_CONTEXT.updateGeneratorSettings(message.settings)
            )
        case "generatePassword":
            return SECURE_CONTEXT.generatePassword()
        case "backup":
            return castVoidPromise(SECURE_CONTEXT.backup())
        case "restore":
            return castVoidPromise(SECURE_CONTEXT.restore(message.url))
        case "exportVaultItems":
            return castVoidPromise(
                SECURE_CONTEXT.exportVaultItems(message.vaultId)
            )
        case "importVaultItems":
            return castVoidPromise(
                SECURE_CONTEXT.importVaultItems(message.vaultId, message.url)
            )
        default:
            console.warn(`Received unknown message type: ${message.id}`)
            return
    }
}

function handleConnect(port: Port, senderType: SenderType) {
    if (port.name === PRIVILEGED_PORT_NAME) {
        if (senderType.id === "privileged") {
            SECURE_CONTEXT.addStatePublisher(new PrivilegedPublisher(port))
        } else {
            port.disconnect()
        }
    } else if (port.name.startsWith(UNPRIVILEGED_PORT_NAME)) {
        const requestedOrigin = port.name.slice(
            UNPRIVILEGED_PORT_NAME.length + 1
        )
        let actualOrigin = undefined
        if (senderType.id === "unprivileged") {
            if (!requestedOrigin || requestedOrigin === senderType.origin) {
                actualOrigin = senderType.origin
            }
        } else if (requestedOrigin) {
            actualOrigin = requestedOrigin
        }
        if (actualOrigin !== undefined) {
            SECURE_CONTEXT.addStatePublisher(
                new UnprivilegedPublisher(actualOrigin, port)
            )
        } else {
            port.disconnect()
        }
    } else {
        console.warn(`Received unknown connection request: ${port.name}`)
    }
}

async function requestAutoFill(
    senderType: SenderType,
    vaultId: string,
    itemId: string
): Promise<AutofillPayload | undefined> {
    if (senderType.id !== "unprivileged") {
        // Only auto-fill unprivileged page
        throw new Error("Auto-fill requested from privileged page")
    }
    const origin = senderType.origin || ""

    const item = await SECURE_CONTEXT.getVaultItem(vaultId, itemId)
    if (!item.origins.includes(origin)) {
        throw new Error("Invalid origin")
    }

    let payload
    if (item.data.encrypted) {
        payload = await SECURE_CONTEXT.decryptVaultItem(vaultId, itemId)
    } else {
        payload = item.data.payload
    }

    if (payload.restrictUrl) {
        if (
            !senderType.url ||
            !payload.loginUrl ||
            !doesLoginUrlMatch(senderType.url, payload.loginUrl)
        ) {
            throw new Error("Invalid URL")
        }
    }

    return {
        fields: payload.fields,
    }
}

async function editStorageAddresses(
    vaultId: string | null,
    action: StorageAddressAction
): Promise<undefined> {
    const addressModifier = (addresses: readonly StorageAddress[]) => {
        const addressKeys = addresses.map(objectKey)
        const addressKey = objectKey(action.storageAddress)
        const addressIndex = addressKeys.indexOf(addressKey)
        const copiedAddresses = [...addresses]
        switch (action.id) {
            case "add":
                if (addressIndex !== -1) {
                    throw new Error("Storage already exists")
                }
                copiedAddresses.push(action.storageAddress)
                break
            case "remove":
                if (addressIndex === -1) {
                    throw new Error("Storage does not exist")
                }
                copiedAddresses.splice(addressIndex, 1)
                break
            case "edit":
                if (addressIndex === -1) {
                    throw new Error("Storage does not exist")
                }
                {
                    const newAddressKey = objectKey(action.newStorageAddress)
                    const newAddressIndex = addressKeys.indexOf(newAddressKey)
                    if (
                        newAddressKey !== addressKey &&
                        newAddressIndex !== -1
                    ) {
                        throw new Error("Storage already exists")
                    }
                    copiedAddresses[addressIndex] = action.newStorageAddress
                }
                break
            case "move":
                if (addressIndex === -1) {
                    throw new Error("Storage does not exist")
                } else if (action.priority >= copiedAddresses.length) {
                    throw new Error("Invalid priority")
                }

                copiedAddresses.splice(
                    action.priority,
                    0,
                    ...copiedAddresses.splice(addressIndex, 1)
                )
                break
        }
        return copiedAddresses
    }

    let storageToWipe = null
    if (action.id === "remove" && action.wipe) {
        storageToWipe = await STORAGE_MANAGER.open(action.storageAddress)
    }
    try {
        if (vaultId !== null) {
            await SECURE_CONTEXT.editVaultStorageAddresses(
                vaultId,
                addressModifier
            )
        } else {
            const rootAddresses: StorageAddress[] = addressModifier(
                await host.loadRootAddresses()
            )
            await host.storeRootAddresses(rootAddresses)
        }

        if (storageToWipe) {
            await storageToWipe.deleteFile(vaultId ?? ROOT_FILE_ID, null)
        }
    } finally {
        storageToWipe && storageToWipe.dispose()
    }

    return
}

export async function openOptionsPage(target: OptionsPageTarget) {
    switch (target.id) {
        case "identity":
            setLocalState("activeTab", "identity")
            break
        case "item":
            setLocalState("activeTab", "items")
            setLocalState("itemSearchTerm", "")
            setLocalState("selectedVaultId", null)
            setLocalState("selectedItemId", target.itemId)
            break
    }
    await host.openOptionsPage()
}

host.onMessage(handleMessage)
host.onConnect(handleConnect)

runInitializers()

host.init(true)
