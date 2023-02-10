import browser, { Runtime } from "webextension-polyfill";
import { addMessageListener, AutofillPayload, ItemDetails, Message, MessageResponse, objectKey, StorageAddressAction } from "../shared"
import { PRIVILEGED_PORT_NAME, StorageAddress } from "../shared/privileged/state";
import { UNPRIVILEGED_PORT_NAME } from "../shared/state";
import { SECURE_CONTEXT } from "./context";
import { PrivilegedPublisher } from "./pubsub/privileged";
import { UnprivilegedPublisher } from "./pubsub/unprivileged";
import "./browserAction"

const EXTENSION_BASE_URL = new URL(browser.runtime.getURL("/"))
const EXTENSION_PROTOCOL = EXTENSION_BASE_URL.protocol
const EXTENSION_HOST = EXTENSION_BASE_URL.host

if (location.protocol !== EXTENSION_PROTOCOL) {
    throw new Error(`Background script was loaded in an unprivileged context (${location.protocol})`)
}

const passwords = [
    { "origin": "https://accounts.google.com", "username": "foo", "password": "bar" },
    { "origin": "https://accounts.google.com", "username": "baz", "password": "bam" },
    { "origin": "https://github.com", "username": "cat", "password": "dog" },
]

type UnprivilegedSender = {
    id: "unprivileged",
    origin?: string,
}
type PrivilegedSender = {
    id: "privileged"
}
type SenderType = UnprivilegedSender | PrivilegedSender

function classifySender(sender: Runtime.MessageSender): SenderType {
    if (sender.url) {
        const url = new URL(sender.url)
        if (url.protocol === EXTENSION_PROTOCOL && url.host === EXTENSION_HOST) {
            return { id: "privileged" }
        }
        return { id: "unprivileged", origin: url.origin }
    } else {
        return { id: "unprivileged" }
    }
}

function handleMessage(message: Message, sender: Runtime.MessageSender): Promise<MessageResponse> | undefined {
    const senderType = classifySender(sender)
    switch (message.id) {
        case "requestAutofill": return requestAutoFill(senderType)
        case "createRoot": return createRoot(senderType, message.masterPassword, message.secretSentence)
        case "editRootName": return editRootName(senderType, message.name)
        case "editStorageAddresses": return editStorageAddresses(senderType, message.vaultId, message.action)
        case "unlock": return unlock(senderType, message.masterPassword, message.secretSentence)
        case "lock": return lock(senderType, message.unenroll)
        case "changeRootPassword": return changeRootPassword(senderType, message.oldPassword, message.newPassword)
        case "createVault": return createVault(senderType, message.name)
        case "removeVault": return removeVault(senderType, message.vaultId)
        case "createVaultItem": return createVaultItem(senderType, message.vaultId, message.details)
        case "updateVaultItem": return updateVaultItem(senderType, message.vaultId, message.itemId, message.details)
        case "deleteVaultItem": return deleteVaultItem(senderType, message.vaultId, message.itemId)
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
    switch (port.name) {
        case PRIVILEGED_PORT_NAME:
            if (senderType.id === "privileged") {
                SECURE_CONTEXT.addStatePublisher(new PrivilegedPublisher(port))
            } else {
                port.disconnect()
            }
            break
        case UNPRIVILEGED_PORT_NAME:
            if (senderType.id === "unprivileged" && senderType.origin) {
                SECURE_CONTEXT.addStatePublisher(new UnprivilegedPublisher(senderType.origin, port))
            } else {
                port.disconnect()
            }
            break
        default:
            console.warn(`Received unknown connection request: ${port.name}`)
            break
    }
}

async function requestAutoFill(senderType: SenderType): Promise<AutofillPayload[]> {
    if (senderType.id !== "unprivileged") {
        // Only auto-fill unprivileged page
        throw new Error("Auto-fill requested from privileged page")
    }
    const origin = senderType.origin || null
    const relevantPasswords = passwords.filter(pw => pw.origin === origin)

    return relevantPasswords
}

async function createRoot(senderType: SenderType, masterPassword: string, secretSentence: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.createRoot(masterPassword, secretSentence)
    return
}

async function editRootName(senderType: SenderType, name: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.updateRootName(name)
    return
}

async function changeRootPassword(senderType: SenderType, oldPassword: string, newPassword: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.changePassword(oldPassword, newPassword)
    return
}

async function editStorageAddresses(senderType: SenderType, vaultId: string | null, action: StorageAddressAction): Promise<undefined> {
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
            case "move":
                if (addressIndex === -1) {
                    throw new Error("Storage does not exist")
                } else if (action.priority >= copiedAddresses.length) {
                    throw new Error("Invalid priority")
                }

                copiedAddresses.splice(action.priority, 0, ...copiedAddresses.splice(addressIndex, 1))
                break
        }
        return copiedAddresses
    }

    if (vaultId !== null) {
        await SECURE_CONTEXT.editVaultStorageAddresses(vaultId, addressModifier)
    } else {
        const res = await browser.storage.sync.get("rootAddresses")
        const rootAddresses: StorageAddress[] = addressModifier(res.rootAddresses || [])
        await browser.storage.sync.set({ rootAddresses })
    }
    return
}

async function unlock(senderType: SenderType, masterPassword: string, secretSentence: string | null): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.unlock(masterPassword, secretSentence)
    return
}

async function lock(senderType: SenderType, unenroll: boolean): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.lock(unenroll)
    return
}

async function createVault(senderType: SenderType, name: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.createVault(name)
    return
}

async function removeVault(senderType: SenderType, vaultId: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.removeVault(vaultId)
    return
}

async function createVaultItem(senderType: SenderType, vaultId: string, details: ItemDetails): Promise<string | undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    return await SECURE_CONTEXT.createVaultItem(vaultId, details)
}

async function updateVaultItem(senderType: SenderType, vaultId: string, itemId: string, details: ItemDetails): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.updateVaultItem(vaultId, itemId, details)
    return
}

async function deleteVaultItem(senderType: SenderType, vaultId: string, itemId: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.deleteVaultItem(vaultId, itemId)
    return
}

addMessageListener(handleMessage)
browser.runtime.onConnect.addListener(handleConnect)
