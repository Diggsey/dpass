import browser, { Runtime } from "webextension-polyfill"
import {
    PRIVILEGED_PORT_NAME,
    StorageAddress,
} from "../shared/privileged/state"
import { UNPRIVILEGED_PORT_NAME, VaultItemPayload } from "../shared/state"
import { SECURE_CONTEXT } from "./context"
import { PrivilegedPublisher } from "./pubsub/privileged"
import { UnprivilegedPublisher } from "./pubsub/unprivileged"
import "./browserAction"
import {
    addMessageListener,
    Message,
    MessageResponse,
    sendMessageToFrame,
} from "../shared/messages"
import { AutofillPayload } from "../shared/messages/autofill"
import { doesLoginUrlMatch, objectKey } from "../shared"
import { StorageAddressAction } from "../shared/messages/storage"
import { ItemDetails } from "../shared/messages/vault"
import { FrameDetails, OptionsPageTarget } from "../shared/messages/misc"
import { setLocalState } from "../shared/ui/hooks"

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

function handleMessage(
    message: Message,
    sender: Runtime.MessageSender
): Promise<MessageResponse> | undefined {
    const senderType = classifySender(sender)
    switch (message.id) {
        case "requestAutofill":
            return requestAutoFill(senderType, message.vaultId, message.itemId)
        case "createRoot":
            return createRoot(
                senderType,
                message.name,
                message.masterPassword,
                message.secretSentence
            )
        case "editRootName":
            return editRootName(senderType, message.name)
        case "editStorageAddresses":
            return editStorageAddresses(
                senderType,
                message.vaultId,
                message.action
            )
        case "unlock":
            return unlock(
                senderType,
                message.masterPassword,
                message.secretSentence
            )
        case "lock":
            return lock(senderType, message.unenroll)
        case "changeRootPassword":
            return changeRootPassword(
                senderType,
                message.oldPassword,
                message.newPassword ?? null,
                message.newSentence ?? null
            )
        case "createVault":
            return createVault(senderType, message.name, message.copyStorage)
        case "removeVault":
            return removeVault(senderType, message.vaultId)
        case "setVaultAsDefault":
            return setVaultAsDefault(senderType, message.vaultId)
        case "editVaultName":
            return editVaultName(senderType, message.vaultId, message.name)
        case "createVaultItem":
            return createVaultItem(senderType, message.vaultId, message.details)
        case "updateVaultItem":
            return updateVaultItem(
                senderType,
                message.vaultId,
                message.itemId,
                message.details
            )
        case "deleteVaultItem":
            return deleteVaultItem(senderType, message.vaultId, message.itemId)
        case "decryptVaultItem":
            return decryptVaultItem(senderType, message.vaultId, message.itemId)
        case "getFrameDetails":
            return getFrameDetails(sender)
        case "forward":
            return forward(
                senderType,
                message.tabId,
                message.frameId,
                message.message
            )
        case "openOptionsPage":
            return openOptionsPage(message.target)
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

    const item = SECURE_CONTEXT.getVaultItem(vaultId, itemId)
    if (!item.origins.includes(origin)) {
        throw new Error("Invalid origin")
    }

    let payload
    if (item.data.encrypted) {
        payload = await SECURE_CONTEXT.decryptVaultItem(vaultId, itemId)
    } else {
        payload = item.data.payload
    }

    if (payload.restrict_url) {
        if (
            !senderType.url ||
            !payload.login_url ||
            !doesLoginUrlMatch(senderType.url, payload.login_url)
        ) {
            throw new Error("Invalid URL")
        }
    }

    return {
        fields: payload.fields,
    }
}

async function createRoot(
    senderType: SenderType,
    name: string,
    masterPassword: string,
    secretSentence: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.createRoot(name, masterPassword, secretSentence)
    return
}

async function editRootName(
    senderType: SenderType,
    name: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.updateRootName(name)
    return
}

async function changeRootPassword(
    senderType: SenderType,
    oldPassword: string,
    newPassword: string | null,
    newSentence: string | null
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.changePassword(oldPassword, newPassword, newSentence)
    return
}

async function editStorageAddresses(
    senderType: SenderType,
    vaultId: string | null,
    action: StorageAddressAction
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }

    const addressModifier = (addresses: StorageAddress[]) => {
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

    if (vaultId !== null) {
        await SECURE_CONTEXT.editVaultStorageAddresses(vaultId, addressModifier)
    } else {
        const res = await browser.storage.sync.get("rootAddresses")
        const rootAddresses: StorageAddress[] = addressModifier(
            res.rootAddresses || []
        )
        await browser.storage.sync.set({ rootAddresses })
    }
    return
}

async function unlock(
    senderType: SenderType,
    masterPassword: string,
    secretSentence: string | null
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.unlock(masterPassword, secretSentence)
    return
}

async function lock(
    senderType: SenderType,
    unenroll: boolean
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.lock(unenroll)
    return
}

async function createVault(
    senderType: SenderType,
    name: string,
    copyStorage: boolean
): Promise<string | undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    return await SECURE_CONTEXT.createVault(name, copyStorage)
}

async function removeVault(
    senderType: SenderType,
    vaultId: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.removeVault(vaultId)
    return
}

async function setVaultAsDefault(
    senderType: SenderType,
    vaultId: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.setVaultAsDefault(vaultId)
    return
}

async function editVaultName(
    senderType: SenderType,
    vaultId: string,
    name: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.updateVaultName(vaultId, name)
    return
}

async function createVaultItem(
    senderType: SenderType,
    vaultId: string,
    details: ItemDetails
): Promise<string | undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    return await SECURE_CONTEXT.createVaultItem(vaultId, details)
}

async function updateVaultItem(
    senderType: SenderType,
    vaultId: string,
    itemId: string,
    details: ItemDetails
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.updateVaultItem(vaultId, itemId, details)
    return
}

async function deleteVaultItem(
    senderType: SenderType,
    vaultId: string,
    itemId: string
): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.deleteVaultItem(vaultId, itemId)
    return
}

async function decryptVaultItem(
    senderType: SenderType,
    vaultId: string,
    itemId: string
): Promise<VaultItemPayload | undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    return await SECURE_CONTEXT.decryptVaultItem(vaultId, itemId)
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

async function forward(
    senderType: SenderType,
    tabId: number,
    frameId: number,
    message: Message
): Promise<unknown | undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    return await sendMessageToFrame(tabId, frameId, message)
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
