import browser from "webextension-polyfill"
import { sendMessage } from "../shared/messages"
import { ContentModalMessage } from "../shared/messages/misc"
import { ModalArgs, ModalList, ModalResult } from "../shared/modal"

type OpenModal = {
    resolve: (arg: never) => void
    reject: (arg: unknown) => void
    iframe: HTMLIFrameElement
}

class ModalError extends Error {}

const openModals: Map<string, OpenModal> = new Map()

function styleModalBg(style: CSSStyleDeclaration) {
    style.position = "fixed"
    style.width = "100%"
    style.height = "100%"
    style.left = "0px"
    style.top = "0px"
    style.overflowY = "auto"
    style.backgroundColor = "rgba(50, 50, 50, 0.5)"
    style.display = "flex"
    style.alignItems = "flex-start"
    style.justifyContent = "center"
    style.zIndex = "2147483647"
}

function styleModal(style: CSSStyleDeclaration) {
    style.border = "none"
    style.borderRadius = "6px"
    style.margin = "auto 0px"
}

export async function openModal<P extends keyof ModalList>(
    page: P,
    args: ModalArgs<P>
): Promise<ModalResult<P>> {
    const frameDetails = await sendMessage({ id: "getFrameDetails" })
    if (!frameDetails) {
        throw new Error("Failed to obtain frame details")
    }
    const iframeUrl = new URL(
        browser.runtime.getURL(`src/entries/${page}/index.html`)
    )
    const requestId = crypto.randomUUID()
    iframeUrl.searchParams.set("args", JSON.stringify(args))
    iframeUrl.searchParams.set("parent", JSON.stringify(frameDetails))
    iframeUrl.searchParams.set("uuid", requestId)
    const appContainer = document.createElement("div")
    appContainer.style.visibility = "hidden"
    const shadowRoot = appContainer.attachShadow({
        mode: import.meta.env.DEV ? "open" : "closed",
    })
    const appRoot = document.createElement("div")
    const iframe = document.createElement("iframe")
    const promise = new Promise<ModalResult<P>>((resolve, reject) => {
        openModals.set(requestId, { resolve, reject, iframe })
    })
    iframe.src = iframeUrl.toString()

    styleModalBg(appRoot.style)
    styleModal(iframe.style)

    appRoot.appendChild(iframe)
    shadowRoot.appendChild(appRoot)
    document.body.appendChild(appContainer)

    setTimeout(() => {
        appContainer.style.visibility = "visible"
    }, 50)

    try {
        return await promise
    } finally {
        appContainer.remove()
    }
}

export function handleModalMessage(message: ContentModalMessage): undefined {
    const modal = openModals.get(message.uuid)
    if (modal) {
        switch (message.payload.id) {
            case "close":
                if (message.payload.resolve !== undefined) {
                    modal.resolve(message.payload.resolve as never)
                } else {
                    modal.reject(new ModalError(message.payload.reject))
                }
                break
            case "resize":
                modal.iframe.style.width = `${message.payload.width}px`
                modal.iframe.style.height = `${message.payload.height}px`
                break
        }
    }

    return
}
