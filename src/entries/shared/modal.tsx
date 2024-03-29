import { ComponentType } from "react"
import { createRoot } from "react-dom/client"
import host from "~/entries/shared/host"
import { DetectedField, RequestAutofillMessage } from "./messages/autofill"
import { FrameDetails } from "./messages/misc"
import { ContentModalPayload } from "./messages/modal"

export type AutofillArgs = {
    readonly origin: string
    readonly url: string
    readonly title: string
    readonly fields: readonly DetectedField[]
}

export type ModalList = {
    autofillEmbed: (arg: AutofillArgs) => RequestAutofillMessage | null
}

export type ModalArgs<P extends keyof ModalList> = Parameters<ModalList[P]>[0]
export type ModalResult<P extends keyof ModalList> = ReturnType<ModalList[P]>

export type ModalProps<P extends keyof ModalList> = {
    args: ModalArgs<P>
    resolve: (result: ModalResult<P>) => void
    reject: (error: unknown) => void
}

export function renderModal<P extends keyof ModalList>(
    _page: P,
    Component: ComponentType<ModalProps<P>>
) {
    const searchParams = new URL(window.location.href).searchParams
    const uuid = searchParams.get("uuid")
    const parentJson = searchParams.get("parent")
    const argsJson = searchParams.get("args")
    if (uuid === null || parentJson === null || argsJson === null) {
        throw new Error("Missing modal params")
    }
    const parent: FrameDetails = JSON.parse(parentJson)
    const args: ModalArgs<P> = JSON.parse(argsJson)

    const sendToParent = (payload: ContentModalPayload) => {
        void host.sendMessageToFrame(parent.tabId, parent.frameId, {
            id: "contentModal",
            uuid,
            payload,
        })
    }
    const resolve = (result: ModalResult<P>) => {
        sendToParent({
            id: "close",
            resolve: result,
        })
    }
    const reject = (err: unknown) => {
        sendToParent({
            id: "close",
            reject: `${err}`,
        })
    }

    const root = createRoot(document.body)
    root.render(<Component args={args} resolve={resolve} reject={reject} />)

    let lastWidth: number | null = null
    let lastHeight: number | null = null
    new ResizeObserver(() => {
        const extraH = 0 //window.outerHeight - window.innerHeight
        const extraW = 0 //window.outerWidth - window.innerWidth
        const newWidth = document.body.offsetWidth + extraW
        const newHeight = document.body.offsetHeight + extraH
        if (lastWidth !== newWidth || lastHeight !== newHeight) {
            lastWidth = newWidth
            lastHeight = newHeight
            sendToParent({
                id: "resize",
                width: newWidth,
                height: newHeight,
            })
        }
    }).observe(document.body)
}
