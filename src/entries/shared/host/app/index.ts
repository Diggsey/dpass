import { Message, MessageResponse } from "../../messages"
import { IStatePublisher } from "../../privileged/state"
import { MessagePrefix, postRawMessage, sendRequest } from "./channel"

export function init() {
    console.info("dpass ready")
}

export function statePublishers(): IStatePublisher[] {
    return []
}

export { connect, sendMessage, onMessage, onConnect } from "./channel"
export {
    onRootAddressesChanged,
    storeRootAddresses,
    loadRootAddresses,
    storeKey,
    loadKey,
    deleteKey,
    beginDownload,
    rememberKey,
    onUnlockWithKey,
} from "./storage"
export { executeCommand, onCommand } from "./commands"
export { requestToken } from "./auth"

export const isTrusted = true

export function getAssetUrl(path: string): string {
    return `/${path}`
}

export function sendMessageToFrame<M extends Message>(
    _tabId: number,
    _frameId: number,
    _m: M
): Promise<MessageResponse<M> | undefined> {
    throw new Error("not implemented")
}

let refreshBlockCount = 0

export function blockRefresh(): () => void {
    if (refreshBlockCount++ == 0) {
        postRawMessage({
            prefix: MessagePrefix.BlockRefresh,
            message: true,
            ports: [],
        })
    }
    return () => {
        if (--refreshBlockCount == 0) {
            postRawMessage({
                prefix: MessagePrefix.BlockRefresh,
                message: false,
                ports: [],
            })
        }
    }
}

export async function copyText(text: string): Promise<void> {
    await sendRequest(MessagePrefix.CopyText, text, [])
}

export async function requestUnlock(waitForUnlock = true) {
    const res = sendRequest(MessagePrefix.RequestUnlock, undefined, [])
    if (waitForUnlock) {
        await res
    }
}

export async function openOptionsPage() {
    await sendRequest(MessagePrefix.ShowApp, undefined, [])
}
