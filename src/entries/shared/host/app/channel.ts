import { executeCommand } from "."
import {
    Port,
    Event,
    MessageHandler,
    ConnectHandler,
    SenderType,
    CommandId,
} from ".."
import { Json, splitN } from "../.."
import { Message, MessageResponse } from "../../messages"
import { handleStorageChanged, handleUnlockWithKey } from "./storage"

export enum MessagePrefix {
    Connect = "connect",
    Message = "message",
    Response = "response",
    Error = "error",
    StorageChanged = "storageChanged",
    ReadStorage = "readStorage",
    WriteStorage = "writeStorage",
    ExecuteCommand = "executeCommand",
    BeginDownload = "beginDownload",
    RequestToken = "requestToken",
    BlockRefresh = "blockRefresh",
    CopyText = "copyText",
    RememberKey = "rememberKey",
    UnlockWithKey = "unlockWithKey",
    RequestUnlock = "requestUnlock",
    ShowApp = "showApp",
}

export type RawMessage = {
    readonly prefix: MessagePrefix
    readonly requestId?: number
    readonly message: Json | undefined
    readonly ports: readonly MessagePort[]
}

export type RawResponse = {
    readonly message: Json | undefined
    readonly ports: readonly MessagePort[]
}

type ConnectMessage = {
    readonly name: string
}

let clientPort: MessagePort | null = null
let nextRequestId = 1
const queuedMessages: [string, MessagePort[]][] = []
const requestMap = new Map<
    number,
    {
        resolve: (value: RawResponse) => void
        reject: (reason?: Json) => void
    }
>()

const messageHandlers: MessageHandler[] = []
const connectHandlers: ConnectHandler[] = []

export function onMessage(handler: MessageHandler) {
    messageHandlers.push(handler)
}

export function onConnect(handler: ConnectHandler) {
    connectHandlers.push(handler)
}

function handleHostMessage(event: MessageEvent<string>) {
    if (!event.isTrusted) {
        return
    }
    console.log("Received host message")
    if (event.ports.length === 1) {
        clientPort = event.ports[0]
        clientPort.onmessage = handleRawMessage
        let m
        while ((m = queuedMessages.shift())) {
            clientPort.postMessage(m[0], m[1])
        }
    }
}

function handleConnectMessage(message: ConnectMessage, rawPort: MessagePort) {
    const senderType: SenderType = { id: "privileged" }
    const port = new AppPort(message.name, rawPort)
    for (const handler of connectHandlers) {
        handler(port, senderType)
    }
}

async function handleMessage(rawMessage: RawMessage): Promise<RawResponse> {
    const senderType: SenderType = { id: "privileged" }
    for (const handler of messageHandlers) {
        const promise = handler(rawMessage.message as Message, senderType)
        if (promise !== undefined) {
            return {
                message: await promise,
                ports: [],
            }
        }
    }
    throw new Error("Not handled")
}

function handleResponseOrErrorMessage(rawMessage: RawMessage) {
    if (rawMessage.requestId === undefined) {
        throw new Error("Response/error messages must have a request ID")
    }
    const handlers = requestMap.get(rawMessage.requestId)
    if (handlers) {
        requestMap.delete(rawMessage.requestId)
        if (rawMessage.prefix === MessagePrefix.Response) {
            handlers.resolve({
                message: rawMessage.message,
                ports: rawMessage.ports,
            })
        } else {
            handlers.reject(rawMessage.message)
        }
    }
}

async function handleRawMessage(event: MessageEvent<string>) {
    console.log(`Received raw message (${event.data}, ${event.ports}) `)
    const parts = splitN(3, event.data, ":")
    if (parts === null) {
        throw new Error(`Invalid message: ${event.data}`)
    }
    const prefix: MessagePrefix = parts[0] as MessagePrefix
    const requestId = parts[1] ? parseInt(parts[1]) : undefined
    const message: Json | undefined =
        parts[2] === "" ? undefined : JSON.parse(parts[2])
    const ports = event.ports
    const rawMessage: RawMessage = {
        prefix,
        requestId,
        message,
        ports,
    }
    let response: RawResponse = {
        message: undefined,
        ports: [],
    }

    try {
        switch (prefix) {
            case MessagePrefix.Response:
            case MessagePrefix.Error:
                handleResponseOrErrorMessage(rawMessage)
                // Never respond to these messages
                return
            case MessagePrefix.Connect:
                handleConnectMessage(
                    rawMessage.message as ConnectMessage,
                    rawMessage.ports[0]
                )
                break
            case MessagePrefix.Message:
                response = await handleMessage(rawMessage)
                break
            case MessagePrefix.StorageChanged:
                handleStorageChanged(rawMessage.message)
                break
            case MessagePrefix.ExecuteCommand:
                executeCommand(rawMessage.message as CommandId)
                break
            case MessagePrefix.UnlockWithKey:
                response = await handleUnlockWithKey(
                    rawMessage.message as string
                )
                break
        }
        if (requestId !== undefined) {
            postRawMessage({
                requestId,
                prefix: MessagePrefix.Response,
                ...response,
            })
        }
    } catch (ex) {
        if (requestId !== undefined) {
            postRawMessage({
                requestId,
                prefix: MessagePrefix.Error,
                message: `${ex}`,
                ports: [],
            })
        } else {
            console.error(ex)
        }
    }
}

export function postRawMessage({
    prefix,
    requestId,
    message,
    ports,
}: RawMessage) {
    const parts = [
        prefix,
        requestId === undefined ? "" : requestId.toString(),
        message === undefined ? "" : JSON.stringify(message),
    ]
    const data = parts.join(":")
    if (clientPort !== null) {
        clientPort.postMessage(data, [...ports])
    } else {
        queuedMessages.push([data, [...ports]])
    }
}

export function sendRequest(
    prefix: MessagePrefix,
    message: Json | undefined,
    ports: MessagePort[]
): Promise<RawResponse> {
    const requestId = nextRequestId++

    const promise = new Promise<RawResponse>((resolve, reject) => {
        requestMap.set(requestId, { resolve, reject })
    })

    postRawMessage({
        prefix,
        requestId,
        message,
        ports,
    })

    return promise
}

export async function sendMessage<M extends Message>(
    m: M
): Promise<MessageResponse<M> | undefined> {
    const { message } = await sendRequest(MessagePrefix.Message, m, [])
    return message as MessageResponse<M> | undefined
}

class AppEvent<F extends (...args: never[]) => unknown> implements Event<F> {
    #callbacks: F[] = []
    addListener(callback: F): void {
        this.#callbacks.push(callback)
    }
    removeListener(callback: F): void {
        const idx = this.#callbacks.indexOf(callback)
        if (idx !== -1) {
            this.#callbacks.splice(idx, 1)
        }
    }
    dispatch(...args: Parameters<F>) {
        for (const callback of this.#callbacks) {
            callback(...args)
        }
    }
}

class AppPort implements Port {
    #name: string
    #inner: MessagePort
    #onDisconnect = new AppEvent<(port: Port) => void>()
    #onMessage = new AppEvent<(message: unknown, port: Port) => void>()

    constructor(name: string, inner: MessagePort) {
        this.#name = name
        this.#inner = inner
        this.#inner.onmessage = (event) => {
            this.#onMessage.dispatch(event.data, this)
        }
    }

    get name(): string {
        return this.#name
    }
    disconnect(): void {
        this.#inner.close()
    }
    get onDisconnect() {
        return this.#onDisconnect
    }
    get onMessage() {
        return this.#onMessage
    }
    postMessage(message: unknown): void {
        this.#inner.postMessage(message)
    }
}

export function connect(name: string): Port {
    const channel = new MessageChannel()
    const message: ConnectMessage = {
        name,
    }
    postRawMessage({
        prefix: MessagePrefix.Connect,
        message,
        ports: [channel.port2],
    })
    return new AppPort(name, channel.port1)
}

globalThis.addEventListener("message", handleHostMessage)
