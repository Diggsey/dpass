import { WebAuthFlowOptions } from ".."
import { Message, MessageResponse } from "../../messages"
import { IStatePublisher } from "../../privileged/state"

export async function requestUnlock() {
    throw new Error("not implemented")
}

export async function openOptionsPage() {
    throw new Error("not implemented")
}

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
    storeToken,
    loadToken,
    beginDownload,
} from "./storage"
export { executeCommand, onCommand } from "./commands"

export const isTrusted = true

export function getRedirectURL(): string {
    throw new Error("not implemented")
}

export async function launchWebAuthFlow(
    _options: WebAuthFlowOptions
): Promise<string> {
    throw new Error("not implemented")
}

export function getAssetUrl(_path: string): string {
    throw new Error("not implemented")
}

export function sendMessageToFrame<M extends Message>(
    _tabId: number,
    _frameId: number,
    _m: M
): Promise<MessageResponse<M> | undefined> {
    throw new Error("not implemented")
}
