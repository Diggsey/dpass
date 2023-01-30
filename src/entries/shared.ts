import browser, { Runtime } from "webextension-polyfill";
import { StorageAddress } from "./shared/privileged/state";

type RequestAutofillMessage = {
    id: "requestAutofill"
}
type PokeActiveFrameMessage = {
    id: "pokeActiveFrame"
}
type OptionsPageOpenedMessage = {
    id: "optionsPageOpened"
}
type CreateRootMessage = {
    id: "createRoot",
    masterPassword: string,
}
type EditRootStorageAddresses = {
    id: "editRootStorageAddresses",
    action: StorageAddressAction
}
export type StorageAddressAction =
    | { id: "add", storageAddress: StorageAddress }
    | { id: "remove", storageAddress: StorageAddress }
    | { id: "move", storageAddress: StorageAddress, priority: number }

type UnlockMessage = {
    id: "unlock",
    masterPassword: string,
}
type LockMessage = {
    id: "lock"
}

export type Message =
    | RequestAutofillMessage
    | PokeActiveFrameMessage
    | OptionsPageOpenedMessage
    | CreateRootMessage
    | EditRootStorageAddresses
    | UnlockMessage
    | LockMessage


type MessageResponses = {
    requestAutofill: AutofillPayload[],
    pokeActiveFrame: boolean,
    optionsPageOpened: undefined,
    createRoot: undefined,
    editRootStorageAddresses: undefined,
    unlock: undefined,
    lock: undefined,
}
export type MessageResponse<M extends Message = Message> = MessageResponses[M["id"]]

export interface AutofillPayload {
    origin: string,
    username: string | null,
    password: string | null,
}

export function expect<T>(arg: T | undefined, err?: string): T {
    if (arg === undefined) {
        throw new Error(err)
    }
    return arg
}

export function sendMessage<M extends Message>(m: M): Promise<MessageResponse<M> | undefined> {
    return browser.runtime.sendMessage(m)
}

export function sendMessageToTab<M extends Message>(tabId: number, m: M): Promise<MessageResponse<M> | undefined> {
    return browser.tabs.sendMessage(tabId, m)
}

export function mapObjectValues<T, U>(obj: { [key: string]: T }, f: (v: T) => U): { [key: string]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}

interface MessageListener {
    (arg: Message, sender: Runtime.MessageSender): Promise<MessageResponse> | undefined
}

export function addMessageListener(listener: MessageListener) {
    browser.runtime.onMessage.addListener(listener)
}
