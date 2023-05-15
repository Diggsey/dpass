import { Json } from ".."

export type ContentModalPayload =
    | CloseContentModalPayload
    | ResizeContentModalPayload

type CloseContentModalPayload = {
    readonly id: "close"
    readonly resolve?: Json
    readonly reject?: string
}

type ResizeContentModalPayload = {
    readonly id: "resize"
    readonly width: number
    readonly height: number
}
