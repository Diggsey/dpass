import browser, { Runtime, Action, Tabs } from "webextension-polyfill";
import { Message, sendMessageToTab } from "../shared"
import { PRIVILEGED_PORT_NAME, StorageAddress } from "../shared/privileged/state";
import { UNPRIVILEGED_PORT_NAME } from "../shared/state";
import { SECURE_CONTEXT } from "./context";
import { PrivilegedPublisher } from "./pubsub/privileged";
import { UnprivilegedPublisher } from "./pubsub/unprivileged";

const EXTENSION_BASE_URL = new URL(browser.runtime.getURL("/"))
const EXTENSION_PROTOCOL = EXTENSION_BASE_URL.protocol
const EXTENSION_HOST = EXTENSION_BASE_URL.host

if (location.protocol !== EXTENSION_PROTOCOL) {
    throw new Error(`Background script was loaded in an unprivileged context (${location.protocol})`)
}

let passwords = [
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

async function beginAutofillAction(tabId: number) {
    // Make sure our content script has been injected. We can't directly trigger
    // anything via this injection because it will have no effect on the second injection.
    await browser.scripting.executeScript({
        target: {
            allFrames: true,
            tabId,
        },
        files: ["/src/entries/content/main.js"],
        injectImmediately: true
    })
    // We don't know which frame is active, so send a message to all of them.
    // Only the active frame will request auto-fill.
    const response = await sendMessageToTab(tabId, { id: "pokeActiveFrame" })
    if (!response) {
        console.warn("No active frame found")
    }
}

function browserActionClicked(tab: Tabs.Tab, info: Action.OnClickData | undefined) {
    let clickAction = SECURE_CONTEXT.currentClickAction
    if (info?.button === 1 || info?.modifiers?.length === 1) {
        clickAction = "showOptions"
    }
    switch (clickAction) {
        case "autofill":
            if (tab.id !== undefined) {
                beginAutofillAction(tab.id)
            } else {
                throw new Error("Not implemented")
            }
            break;

        case "showOptions":
            browser.runtime.openOptionsPage()
            break;
        case "requestPassword":
            showPopup("src/entries/unlockPopup/index.html")
            break;
        case "none":
            showPopup("src/entries/noActionPopup/index.html")
            break;
    }
}

function showPopup(popup: string): Promise<void> {
    browser.browserAction.setPopup({ popup })
    const res = browser.browserAction.openPopup()
    browser.browserAction.setPopup({ popup: null })
    return res
}

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

function handleMessage(message: Message, sender: Runtime.MessageSender) {
    const senderType = classifySender(sender)
    switch (message.id) {
        case "requestAutofill": return requestAutoFill(senderType)
        case "createRoot": return createRoot(senderType, message.masterPassword)
        case "addRootStorageAddress": return addRootStorageAddress(senderType, message.storageAddress)
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

async function requestAutoFill(senderType: SenderType) {
    if (senderType.id !== "unprivileged") {
        // Only auto-fill unprivileged page
        return
    }
    const origin = senderType.origin || null
    const relevantPasswords = passwords.filter(pw => pw.origin === origin)

    return relevantPasswords
}

async function createRoot(senderType: SenderType, masterPassword: string) {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.createRoot(masterPassword)
}

async function addRootStorageAddress(senderType: SenderType, storageAddress: StorageAddress) {
    if (senderType.id !== "privileged") {
        return
    }
    const res = await browser.storage.sync.get("rootAddresses")
    const rootAddresses: StorageAddress[] = res.rootAddresses || []
    rootAddresses.push(storageAddress)
    await browser.storage.sync.set({ rootAddresses })
}

async function unlock(senderType: SenderType, masterPassword: string) {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.unlock(masterPassword)
}

async function lock(senderType: SenderType) {
    if (senderType.id !== "privileged") {
        return
    }
    await SECURE_CONTEXT.lock()
}

browser.browserAction.onClicked.addListener(browserActionClicked)
browser.runtime.onMessage.addListener(handleMessage)
browser.runtime.onConnect.addListener(handleConnect)