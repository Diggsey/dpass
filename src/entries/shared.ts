import browser from "webextension-polyfill";

type RequestAutofillMessage = {
    id: 'requestAutofill'
}
type PokeActiveFrameMessage = {
    id: 'pokeActiveFrame'
}
export type Message = RequestAutofillMessage | PokeActiveFrameMessage

export interface AutofillPayload {
    origin: string,
    username: string | null,
    password: string | null,
}

export function expect<T>(arg: T | undefined, err: string): T {
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