export type ContentModalPayload =
    | CloseContentModalPayload
    | ResizeContentModalPayload

type CloseContentModalPayload = {
    id: "close"
    resolve?: unknown
    reject?: string
}

type ResizeContentModalPayload = {
    id: "resize"
    width: number
    height: number
}
