import browser, { Runtime } from "webextension-polyfill";
import { addMessageListener, AutofillPayload, Message, MessageResponse, StorageAddressAction } from "../shared"
import { PRIVILEGED_PORT_NAME, StorageAddress } from "../shared/privileged/state";
import { UNPRIVILEGED_PORT_NAME } from "../shared/state";
import { SECURE_CONTEXT } from "./context";
import { PrivilegedPublisher } from "./pubsub/privileged";
import { UnprivilegedPublisher } from "./pubsub/unprivileged";
import { objectKey } from "./storage/connection";
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
        case "createRoot": return createRoot(senderType, message.masterPassword)
        case "editRootStorageAddresses": return editRootStorageAddresses(senderType, message.action)
        case "unlock": return unlock(senderType, message.masterPassword)
        case "lock": return lock(senderType)
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

async function createRoot(senderType: SenderType, masterPassword: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.createRoot(masterPassword)
    return
}

async function editRootStorageAddresses(senderType: SenderType, action: StorageAddressAction): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    const res = await browser.storage.sync.get("rootAddresses")
    const rootAddresses: StorageAddress[] = res.rootAddresses || []
    const addressKeys = rootAddresses.map(objectKey)
    const addressKey = objectKey(action.storageAddress)
    const addressIndex = addressKeys.indexOf(addressKey)
    switch (action.id) {
        case "add":
            if (addressIndex !== -1) {
                throw new Error("Storage already exists")
            }
            rootAddresses.push(action.storageAddress)
            break
        case "remove":
            if (addressIndex === -1) {
                throw new Error("Storage does not exist")
            }
            rootAddresses.splice(addressIndex, 1)
            break
        case "move":
            if (addressIndex === -1) {
                throw new Error("Storage does not exist")
            } else if (action.priority >= rootAddresses.length) {
                throw new Error("Invalid priority")
            }

            rootAddresses.splice(action.priority, 0, ...rootAddresses.splice(addressIndex, 1))
            break
    }
    await browser.storage.sync.set({ rootAddresses })
    return
}

async function unlock(senderType: SenderType, masterPassword: string): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.unlock(masterPassword)
    return
}

async function lock(senderType: SenderType): Promise<undefined> {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.lock()
    return
}

addMessageListener(handleMessage)
browser.runtime.onConnect.addListener(handleConnect)
