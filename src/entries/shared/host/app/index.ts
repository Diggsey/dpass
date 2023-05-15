import {
    CommandHandler,
    CommandId,
    PersistentKeyType,
    RootAddressesChangedHandler,
    WebAuthFlowOptions,
} from ".."
import { Message, MessageResponse } from "../../messages"
import {
    AuthToken,
    ConnectionInfo,
    IStatePublisher,
    StorageAddress,
} from "../../privileged/state"

export async function requestUnlock() {
    throw new Error("not implemented")
}

export function onCommand(_f: CommandHandler) {
    throw new Error("not implemented")
}

export function executeCommand(_commandId: CommandId) {
    throw new Error("not implemented")
}

export async function openOptionsPage() {
    throw new Error("not implemented")
}

export function init(): IStatePublisher[] {
    return []
}

export function beginDownload(_filename: string, _blob: Blob) {
    throw new Error("not implemented")
}

export { connect, sendMessage, onMessage, onConnect } from "./channel"

export const isTrusted = true

export async function storeKey(
    _keyType: PersistentKeyType,
    _key: CryptoKey
): Promise<void> {
    throw new Error("not implemented")
}
export async function loadKey(
    _keyType: PersistentKeyType
): Promise<CryptoKey | null> {
    throw new Error("not implemented")
}
export async function deleteKey(_keyType: PersistentKeyType): Promise<void> {
    throw new Error("not implemented")
}

export async function storeRootAddresses(
    _rootAddresses: StorageAddress[]
): Promise<void> {
    throw new Error("not implemented")
}

export async function loadRootAddresses(): Promise<StorageAddress[]> {
    return []
}

export function onRootAddressesChanged(_handler: RootAddressesChangedHandler) {
    throw new Error("not implemented")
}
export async function storeToken(
    _connectionInfo: ConnectionInfo,
    _token: AuthToken
): Promise<void> {
    throw new Error("not implemented")
}
export async function loadToken(
    _connectionInfo: ConnectionInfo
): Promise<AuthToken | null> {
    throw new Error("not implemented")
}

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
