import browser, { Runtime } from "webextension-polyfill"
import {
    PRIVILEGED_PORT_NAME,
    StorageAddress,
} from "../shared/privileged/state"
import { UNPRIVILEGED_PORT_NAME } from "../shared/state"
import { SECURE_CONTEXT } from "./context"
import { PrivilegedPublisher } from "./pubsub/privileged"
import { UnprivilegedPublisher } from "./pubsub/unprivileged"
import "./browserAction"
import "./contextMenus"
import "./commands"
import {
    addMessageListener,
    Message,
    MessageResponse,
    sendMessageToFrame,
} from "../shared/messages"
import { AutofillPayload } from "../shared/messages/autofill"
import { doesLoginUrlMatch, objectKey } from "../shared"
import { StorageAddressAction } from "../shared/messages/storage"
import { FrameDetails, OptionsPageTarget } from "../shared/messages/misc"
import { setLocalState } from "../shared/ui/hooks"
import { STORAGE_MANAGER } from "./storage/connection"
import { ROOT_FILE_ID } from "./context/rootContext"
import { runInitializers } from "./init"

const EXTENSION_BASE_URL = new URL(browser.runtime.getURL("/"))
const EXTENSION_PROTOCOL = EXTENSION_BASE_URL.protocol
const EXTENSION_HOST = EXTENSION_BASE_URL.host

if (location.protocol !== EXTENSION_PROTOCOL) {
    throw new Error(
        `Background script was loaded in an unprivileged context (${location.protocol})`
    )
}

type UnprivilegedSender = {
    id: "unprivileged"
    origin?: string
    url?: URL
}
type PrivilegedSender = {
    id: "privileged"
}
type SenderType = UnprivilegedSender | PrivilegedSender

function classifySender(sender: Runtime.MessageSender): SenderType {
    if (sender.url) {
        const url = new URL(sender.url)
        if (
            url.protocol === EXTENSION_PROTOCOL &&
            url.host === EXTENSION_HOST
        ) {
            return { id: "privileged" }
        }
        return { id: "unprivileged", origin: url.origin, url }
    } else {
        return { id: "unprivileged" }
    }
}

const unprivilegedMessages = [
    "requestAutofill",
    "getFrameDetails",
    "openOptionsPage",
]

function handleMessage(
    message: Message,
    sender: Runtime.MessageSender
): Promise<MessageResponse> | undefined {
    const senderType = classifySender(sender)
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
            return SECURE_CONTEXT.createRoot(
                message.name,
                message.masterPassword,
                message.secretSentence
            )
        case "editRootName":
            return SECURE_CONTEXT.updateRootName(message.name)
        case "editStorageAddresses":
            return editStorageAddresses(message.vaultId, message.action)
        case "unlock":
            return SECURE_CONTEXT.unlock(
                message.masterPassword,
                message.secretSentence
            )
        case "lock":
            return SECURE_CONTEXT.lock(message.unenroll)
        case "changeRootPassword":
            return SECURE_CONTEXT.changePassword(
                message.oldPassword,
                message.newPassword ?? null,
                message.newSentence ?? null
            )
        case "createVault":
            return SECURE_CONTEXT.createVault(message.name, message.copyStorage)
        case "removeVault":
            return SECURE_CONTEXT.removeVault(message.vaultId)
        case "setVaultAsDefault":
            return SECURE_CONTEXT.setVaultAsDefault(message.vaultId)
        case "clearHistory":
            return SECURE_CONTEXT.clearHistory()
        case "editVaultName":
            return SECURE_CONTEXT.updateVaultName(message.vaultId, message.name)
        case "createVaultItem":
            return SECURE_CONTEXT.createVaultItem(
                message.vaultId,
                message.details
            )
        case "updateVaultItem":
            return SECURE_CONTEXT.updateVaultItem(
                message.vaultId,
                message.itemId,
                message.details
            )
        case "deleteVaultItem":
            return SECURE_CONTEXT.deleteVaultItem(
                message.vaultId,
                message.itemId
            )
        case "decryptVaultItem":
            return SECURE_CONTEXT.decryptVaultItem(
                message.vaultId,
                message.itemId
            )
        case "getFrameDetails":
            return getFrameDetails(sender)
        case "forward":
            return sendMessageToFrame(
                message.tabId,
                message.frameId,
                message.message
            )
        case "openOptionsPage":
            return openOptionsPage(message.target)
        case "editGeneratorSettings":
            return SECURE_CONTEXT.updateGeneratorSettings(message.settings)
        case "generatePassword":
            return SECURE_CONTEXT.generatePassword()
        case "backup":
            return SECURE_CONTEXT.backup()
        case "restore":
            return SECURE_CONTEXT.restore(message.url)
        case "exportVaultItems":
            return SECURE_CONTEXT.exportVaultItems(message.vaultId)
        case "importVaultItems":
            return SECURE_CONTEXT.importVaultItems(message.vaultId, message.url)
        default:
            console.warn(`Received unknown message type: ${message.id}`)
            return
    }
}

function handleConnect(port: Runtime.Port) {
    if (!port.sender) {
        return
    }
    const senderType = classifySender(port.sender)
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
            const res = await browser.storage.sync.get("rootAddresses")
            const rootAddresses: StorageAddress[] = addressModifier(
                res.rootAddresses || []
            )
            await browser.storage.sync.set({ rootAddresses })
        }

        if (storageToWipe) {
            await storageToWipe.deleteFile(vaultId ?? ROOT_FILE_ID, null)
        }
    } finally {
        storageToWipe && storageToWipe.dispose()
    }

    return
}

async function getFrameDetails(
    sender: Runtime.MessageSender
): Promise<FrameDetails | undefined> {
    if (
        sender.tab?.windowId === undefined ||
        sender.tab.id === undefined ||
        sender.frameId === undefined
    ) {
        return
    }
    return {
        windowId: sender.tab.windowId,
        tabId: sender.tab.id,
        frameId: sender.frameId,
    }
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
    await browser.runtime.openOptionsPage()
}

addMessageListener(handleMessage)
browser.runtime.onConnect.addListener(handleConnect)

runInitializers()
