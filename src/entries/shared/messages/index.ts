import browser, { Runtime } from "webextension-polyfill"
import { VaultItemPayload } from "../state"
import {
    AutofillPayload,
    PerformAutofillMessage,
    PokeActiveFrameMessage,
    PokeFrameResponse,
    RequestAutofillMessage,
    ShowItemSelectorMessage,
} from "./autofill"
import {
    ContentModalMessage,
    ForwardMessage,
    FrameDetails,
    GetFrameDetailsMessage,
    OpenOptionsPage,
    OptionsPageOpenedMessage,
} from "./misc"
import {
    ChangeRootPasswordMessage,
    CreateRootMessage,
    CreateVaultMessage,
    EditRootNameMessage,
    LockMessage,
    RemoveVaultMessage,
    SetVaultAsDefault,
    UnlockMessage,
} from "./root"
import { EditStorageAddressesMessage } from "./storage"
import {
    CreateVaultItemMessage,
    DecryptVaultItemMessage,
    DeleteVaultItemMessage,
    UpdateVaultItemMessage,
} from "./vault"

export type Message =
    | RequestAutofillMessage
    | PokeActiveFrameMessage
    | ShowItemSelectorMessage
    | PerformAutofillMessage
    | OptionsPageOpenedMessage
    | CreateRootMessage
    | EditRootNameMessage
    | EditStorageAddressesMessage
    | UnlockMessage
    | LockMessage
    | ChangeRootPasswordMessage
    | CreateVaultMessage
    | RemoveVaultMessage
    | SetVaultAsDefault
    | CreateVaultItemMessage
    | DeleteVaultItemMessage
    | UpdateVaultItemMessage
    | DecryptVaultItemMessage
    | GetFrameDetailsMessage
    | ContentModalMessage
    | ForwardMessage
    | OpenOptionsPage

type MessageResponses = {
    requestAutofill: AutofillPayload
    pokeActiveFrame: PokeFrameResponse
    showItemSelector: RequestAutofillMessage | null
    performAutofill: undefined
    optionsPageOpened: undefined
    createRoot: undefined
    editRootName: undefined
    editStorageAddresses: undefined
    unlock: undefined
    lock: undefined
    changeRootPassword: undefined
    createVault: string
    removeVault: undefined
    setVaultAsDefault: undefined
    createVaultItem: string
    deleteVaultItem: undefined
    updateVaultItem: undefined
    decryptVaultItem: VaultItemPayload
    getFrameDetails: FrameDetails
    contentModal: undefined
    forward: unknown
    openOptionsPage: undefined
}
export type MessageResponse<M extends Message = Message> =
    MessageResponses[M["id"]]

export function sendMessage<M extends Message>(
    m: M
): Promise<MessageResponse<M> | undefined> {
    return browser.runtime.sendMessage(m)
}

export function sendMessageToTab<M extends Message>(
    tabId: number,
    m: M
): Promise<MessageResponse<M> | undefined> {
    return browser.tabs.sendMessage(tabId, m)
}

export function sendMessageToFrame<M extends Message>(
    tabId: number,
    frameId: number,
    m: M
): Promise<MessageResponse<M> | undefined> {
    if (!browser.tabs) {
        return sendMessage({
            id: "forward",
            tabId,
            frameId,
            message: m,
        }) as Promise<MessageResponse<M> | undefined>
    }
    return browser.tabs.sendMessage(tabId, m, {
        frameId,
    })
}

interface MessageListener {
    (arg: Message, sender: Runtime.MessageSender):
        | Promise<MessageResponse>
        | undefined
}

export function addMessageListener(listener: MessageListener) {
    browser.runtime.onMessage.addListener(listener)
}
