import { Message } from "."
import { ContentModalPayload } from "./modal"

export type OptionsPageOpenedMessage = {
    readonly id: "optionsPageOpened"
}
export type GetFrameDetailsMessage = {
    readonly id: "getFrameDetails"
}
export type ContentModalMessage = {
    readonly id: "contentModal"
    readonly uuid: string
    readonly payload: ContentModalPayload
}
export type ForwardMessage = {
    readonly id: "forward"
    readonly tabId: number
    readonly frameId: number
    readonly message: Message
}
export type FrameDetails = {
    readonly windowId: number
    readonly tabId: number
    readonly frameId: number
}
export type OpenOptionsPage = {
    readonly id: "openOptionsPage"
    readonly target: OptionsPageTarget
}

export type OptionsPageTarget = OptionsPageItem | OptionsPageIdentity

export type OptionsPageItem = {
    readonly id: "item"
    readonly itemId: string
}

export type OptionsPageIdentity = {
    readonly id: "identity"
}
