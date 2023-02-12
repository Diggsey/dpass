import browser, { Runtime } from "webextension-polyfill";
import { StorageAddress } from "./privileged/state";
import { VaultItemPayload } from "./state";

export type RequestAutofillMessage = {
    id: "requestAutofill"
    vaultId: string,
    itemId: string,
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
    secretSentence: string,
}
type EditRootNameMessage = {
    id: "editRootName",
    name: string,
}
type EditStorageAddressesMessage = {
    id: "editStorageAddresses",
    vaultId: string | null,
    action: StorageAddressAction
}
type ChangeRootPasswordMessage = {
    id: "changeRootPassword",
    oldPassword: string,
    newPassword: string,
}
type CreateVaultMessage = {
    id: "createVault",
    name: string,
}
type RemoveVaultMessage = {
    id: "removeVault",
    vaultId: string,
}
export type StorageAddressAction =
    | { id: "add", storageAddress: StorageAddress }
    | { id: "remove", storageAddress: StorageAddress }
    | { id: "move", storageAddress: StorageAddress, priority: number }

type UnlockMessage = {
    id: "unlock",
    masterPassword: string,
    secretSentence: string | null,
}
type LockMessage = {
    id: "lock",
    unenroll: boolean,
}
export type ItemDetails = {
    origins: string[],
    name: string,
    encrypted: boolean,
    payload?: VaultItemPayload,
}
type CreateVaultItemMessage = {
    id: "createVaultItem",
    vaultId: string,
    details: ItemDetails,
}
type DeleteVaultItemMessage = {
    id: "deleteVaultItem",
    vaultId: string,
    itemId: string,
}
type UpdateVaultItemMessage = {
    id: "updateVaultItem",
    vaultId: string,
    itemId: string,
    details: ItemDetails,
}
type DecryptVaultItemMessage = {
    id: "decryptVaultItem",
    vaultId: string,
    itemId: string,
}
type GetFrameDetailsMessage = {
    id: "getFrameDetails",
}
export type ContentModalMessage = {
    id: "contentModal",
    uuid: string,
    payload: ContentModalPayload,
}

export type ContentModalPayload = CloseContentModalPayload | ResizeContentModalPayload

type CloseContentModalPayload = {
    id: "close"
    resolve?: unknown,
    reject?: string,
}

type ResizeContentModalPayload = {
    id: "resize",
    width: number,
    height: number,
}

type ForwardMessage = {
    id: "forward",
    tabId: number,
    frameId: number,
    message: Message,
}

export type Message =
    | RequestAutofillMessage
    | PokeActiveFrameMessage
    | OptionsPageOpenedMessage
    | CreateRootMessage
    | EditRootNameMessage
    | EditStorageAddressesMessage
    | UnlockMessage
    | LockMessage
    | ChangeRootPasswordMessage
    | CreateVaultMessage
    | RemoveVaultMessage
    | CreateVaultItemMessage
    | DeleteVaultItemMessage
    | UpdateVaultItemMessage
    | DecryptVaultItemMessage
    | GetFrameDetailsMessage
    | ContentModalMessage
    | ForwardMessage


type MessageResponses = {
    requestAutofill: AutofillPayload,
    pokeActiveFrame: boolean,
    optionsPageOpened: undefined,
    createRoot: undefined,
    editRootName: undefined,
    editStorageAddresses: undefined,
    unlock: undefined,
    lock: undefined,
    changeRootPassword: undefined,
    createVault: undefined,
    removeVault: undefined,
    createVaultItem: string,
    deleteVaultItem: undefined,
    updateVaultItem: undefined,
    decryptVaultItem: VaultItemPayload,
    getFrameDetails: FrameDetails,
    contentModal: undefined,
    forward: unknown,
}
export type MessageResponse<M extends Message = Message> = MessageResponses[M["id"]]

export interface AutofillPayload {
    origin: string,
    username: string | null,
    password: string | null,
}

export type FrameDetails = {
    windowId: number,
    tabId: number,
    frameId: number,
}

export function expect<T>(arg: T | undefined, err?: string): T {
    if (arg === undefined) {
        throw new Error(err)
    }
    return arg
}

interface ObjectWithId extends Object {
    id: string
}

export function objectKey({ id, ...params }: ObjectWithId): string {
    const paramsArray = Object.entries(params)
    paramsArray.sort((a, b) => a[0].localeCompare(b[0]))
    const paramStr = paramsArray.map(([k, v]) => `${k}=${v}`).join(",")
    return `${id}:${paramStr}`
}

export function sendMessage<M extends Message>(m: M): Promise<MessageResponse<M> | undefined> {
    return browser.runtime.sendMessage(m)
}

export function sendMessageToTab<M extends Message>(tabId: number, m: M): Promise<MessageResponse<M> | undefined> {
    return browser.tabs.sendMessage(tabId, m)
}

export function sendMessageToFrame<M extends Message>(tabId: number, frameId: number, m: M): Promise<MessageResponse<M> | undefined> {
    if (!browser.tabs) {
        return sendMessage({ id: "forward", tabId, frameId, message: m }) as Promise<MessageResponse<M> | undefined>
    }
    return browser.tabs.sendMessage(tabId, m, {
        frameId,
    })
}

export function mapObjectValues<T, U>(obj: { [key: string]: T }, f: (v: T) => U): { [key: string]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}

export function filterObjectValues<T>(obj: { [key: string]: T }, f: (v: T) => boolean): { [key: string]: T } {
    return Object.fromEntries(Object.entries(obj).filter(([_k, v]) => f(v)))
}

interface MessageListener {
    (arg: Message, sender: Runtime.MessageSender): Promise<MessageResponse> | undefined
}

export function addMessageListener(listener: MessageListener) {
    browser.runtime.onMessage.addListener(listener)
}

export function doesLoginUrlMatch(urlStr: string | URL, loginUrlStr: string | URL): boolean {
    const loginUrl = new URL(loginUrlStr)
    const url = new URL(urlStr)
    if (loginUrl.search === "") {
        url.search = ""
    }
    if (loginUrl.hash === "") {
        url.hash = ""
    }
    return url.href === loginUrl.href
}