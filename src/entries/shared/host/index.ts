import { Message, MessageResponse } from "../messages"
import { FrameDetails } from "../messages/misc"
import {
    AuthTokenPayload,
    ConnectionInfo,
    IStatePublisher,
    StorageAddress,
} from "../privileged/state"

export type CommandId =
    | "dpass-configure"
    | "dpass-sync"
    | "dpass-lock"
    | "dpass-unlock"

export type CommandHandler = (commandId: string) => void

export type UnprivilegedSender = {
    id: "unprivileged"
    origin?: string
    url?: URL
}
export type PrivilegedSender = {
    id: "privileged"
}
export type SenderType = UnprivilegedSender | PrivilegedSender

export type MessageHandler = (
    message: Message,
    senderType: SenderType,
    frameDetails?: FrameDetails | undefined
) => Promise<MessageResponse> | undefined

export interface Event<T extends (...args: never[]) => unknown> {
    addListener(callback: T): void
    removeListener(callback: T): void
}

export interface Port {
    get name(): string
    disconnect(): void
    onDisconnect: Event<(port: Port) => void>
    onMessage: Event<(message: unknown, port: Port) => void>
    postMessage(message: unknown): void
}

export type ConnectHandler = (port: Port, senderType: SenderType) => void
export type RootAddressesChangedHandler = () => void

export enum PersistentKeyType {
    setupKey = "setupKey",
}

export type WebAuthFlowOptions = {
    url: string
    interactive?: boolean
}
export type UnlockWithKeyHandler = (key: CryptoKey) => Promise<void>

export interface Host {
    get isTrusted(): boolean
    requestUnlock(waitForUnlock?: boolean): Promise<void>
    executeCommand(commandId: CommandId): void
    openOptionsPage(): Promise<void>
    init(): void
    statePublishers(): IStatePublisher[]
    beginDownload(filename: string, blob: Blob): void
    connect(name: string): Port
    storeKey(keyType: PersistentKeyType, key: CryptoKey): Promise<void>
    loadKey(keyType: PersistentKeyType): Promise<CryptoKey | null>
    deleteKey(keyType: PersistentKeyType): Promise<void>
    storeRootAddresses(rootAddresses: StorageAddress[]): Promise<void>
    loadRootAddresses(): Promise<StorageAddress[]>
    getAssetUrl(path: string): string
    sendMessage<M extends Message>(
        m: M
    ): Promise<MessageResponse<M> | undefined>

    sendMessageToFrame<M extends Message>(
        tabId: number,
        frameId: number,
        m: M
    ): Promise<MessageResponse<M> | undefined>

    onCommand(handler: CommandHandler): void
    onRootAddressesChanged(handler: RootAddressesChangedHandler): void
    onMessage(handler: MessageHandler): void
    onConnect(handler: ConnectHandler): void
    requestToken(
        connectionInfo: ConnectionInfo
    ): Promise<[AuthTokenPayload, ConnectionInfo]>
    blockRefresh(): () => void
    copyText(text: string): Promise<void>
    rememberKey(key: CryptoKey): Promise<void>
    onUnlockWithKey(handler: UnlockWithKeyHandler): void
}

let host: Host

if (!globalThis.chrome?.runtime?.id) {
    host = await import("./app")
} else {
    host = await import("./extension")
}

export default host
