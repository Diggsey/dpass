import { Message } from "."
import { ContentModalPayload } from "./modal"

export type OptionsPageOpenedMessage = {
    id: "optionsPageOpened"
}
export type GetFrameDetailsMessage = {
    id: "getFrameDetails"
}
export type ContentModalMessage = {
    id: "contentModal"
    uuid: string
    payload: ContentModalPayload
}
export type ForwardMessage = {
    id: "forward"
    tabId: number
    frameId: number
    message: Message
}
export type FrameDetails = {
    windowId: number
    tabId: number
    frameId: number
}
