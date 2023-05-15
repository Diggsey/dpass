import { Port, Event, MessageHandler, ConnectHandler, SenderType } from ".."
import { Json } from "../.."
import { Message, MessageResponse } from "../../messages"

enum MessagePrefix {
    Connect = "connect",
    Message = "message",
    Response = "response",
}

type RawMessage = {
    readonly prefix: MessagePrefix
    readonly message: Json
    readonly ports: MessagePort[]
}

type RequestWrapper = {
    readonly requestId: number
    readonly request: Json
}

type ResponseWrapper = {
    readonly requestId: number
    readonly response?: Json
    readonly error?: string
}

type Response = {
    readonly response?: Json
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
        resolve: (value: Response) => void
        reject: (reason?: unknown) => void
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

async function handleMessage(message: RequestWrapper) {
    const senderType: SenderType = { id: "privileged" }
    let error: string | undefined = "Not handled"
    let response: Json | undefined = undefined
    for (const handler of messageHandlers) {
        const promise = handler(message.request as Message, senderType)
        if (promise !== undefined) {
            try {
                response = await promise
                error = undefined
            } catch (ex) {
                error = `${ex}`
            }
            break
        }
    }
    const responseMessage: ResponseWrapper = {
        requestId: message.requestId,
        response,
        error,
    }

    postRawMessage({
        prefix: MessagePrefix.Response,
        message: responseMessage,
        ports: [],
    })
}

function handleResponseMessage(
    message: ResponseWrapper,
    ports: readonly MessagePort[]
) {
    const handlers = requestMap.get(message.requestId)
    if (handlers) {
        requestMap.delete(message.requestId)
        handlers.resolve({
            response: message.response,
            ports,
        })
    }
}

function handleRawMessage(event: MessageEvent<string>) {
    const parts = event.data.split(":", 2)
    if (parts.length !== 2) {
        throw new Error(`Invalid message: ${event.data}`)
    }
    const prefix: MessagePrefix = parts[0] as MessagePrefix
    const message = JSON.parse(parts[1])
    switch (prefix) {
        case MessagePrefix.Connect:
            handleConnectMessage(message as ConnectMessage, event.ports[0])
            break
        case MessagePrefix.Message:
            void handleMessage(message as RequestWrapper)
            break
        case MessagePrefix.Response:
            handleResponseMessage(message as ResponseWrapper, event.ports)
            break
    }
}

function postRawMessage({ prefix, message, ports }: RawMessage) {
    const data = prefix + ":" + JSON.stringify(message)
    if (clientPort !== null) {
        clientPort.postMessage(data, ports)
    } else {
        queuedMessages.push([data, ports])
    }
}

function sendRequest(
    prefix: MessagePrefix,
    request: Json,
    ports: MessagePort[]
): Promise<Response> {
    const requestId = nextRequestId++

    const promise = new Promise<Response>((resolve, reject) => {
        requestMap.set(requestId, { resolve, reject })
    })

    const message: RequestWrapper = {
        requestId,
        request,
    }

    postRawMessage({
        prefix,
        message,
        ports,
    })

    return promise
}

export async function sendMessage<M extends Message>(
    m: M
): Promise<MessageResponse<M> | undefined> {
    const { response } = await sendRequest(MessagePrefix.Message, m, [])
    return response as MessageResponse<M> | undefined
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
