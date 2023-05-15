import { ConnectHandler, MessageHandler, Port, SenderType } from ".."
import browser, { Runtime } from "webextension-polyfill"
import { Message, MessageResponse } from "../../messages"
import { FrameDetails } from "../../messages/misc"

const messageHandlers: MessageHandler[] = []

export function onMessage(handler: MessageHandler) {
    messageHandlers.push(handler)
}

const connectHandlers: ConnectHandler[] = []

export function onConnect(handler: ConnectHandler) {
    connectHandlers.push(handler)
}

export function connect(name: string): Port {
    return browser.runtime.connect({ name })
}

const EXTENSION_BASE_URL = new URL(browser.runtime.getURL("/"))
const EXTENSION_PROTOCOL = EXTENSION_BASE_URL.protocol
const EXTENSION_HOST = EXTENSION_BASE_URL.host

export const isTrusted = location.protocol === EXTENSION_PROTOCOL

function getFrameDetails(
    sender: Runtime.MessageSender
): FrameDetails | undefined {
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
    const frameDetails = getFrameDetails(sender)
    for (const handler of messageHandlers) {
        const result = handler(message, senderType, frameDetails)
        if (result !== undefined) {
            return result
        }
    }
    return undefined
}

browser.runtime.onMessage.addListener(handleMessage)

function handleConnect(port: Runtime.Port): void {
    if (!port.sender) {
        return
    }
    const senderType = classifySender(port.sender)
    for (const handler of connectHandlers) {
        handler(port, senderType)
    }
}

browser.runtime.onConnect.addListener(handleConnect)

export function sendMessage<M extends Message>(
    m: M
): Promise<MessageResponse<M> | undefined> {
    return browser.runtime.sendMessage(m)
}

export function sendMessageToTab<M extends Message>(
    tabId: number,
    m: M
): Promise<MessageResponse<M> | undefined> {
    return browser.tabs.sendMessage(tabId, m)
}

export function sendMessageToFrame<M extends Message>(
    tabId: number,
    frameId: number,
    m: M
): Promise<MessageResponse<M> | undefined> {
    if (!browser.tabs) {
        return sendMessage({
            id: "forward",
            tabId,
            frameId,
            message: m,
        }) as Promise<MessageResponse<M> | undefined>
    }
    return browser.tabs.sendMessage(tabId, m, {
        frameId,
    })
}
