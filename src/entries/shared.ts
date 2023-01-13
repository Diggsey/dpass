import browser from "webextension-polyfill";
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
type AddRootStorageAddress = {
    id: "addRootStorageAddress",
    storageAddress: StorageAddress,
}
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
    | AddRootStorageAddress
    | UnlockMessage
    | LockMessage

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

export function sendMessage(m: Message): Promise<any> {
    return browser.runtime.sendMessage(m)
}

export function sendMessageToTab(tabId: number, m: Message): Promise<any> {
    return browser.tabs.sendMessage(tabId, m)
}

export function mapObjectValues<T, U>(obj: { [key: string]: T }, f: (v: T) => U): { [key: string]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}