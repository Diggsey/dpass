import browser from "webextension-polyfill"
import { ComponentChild, render, h, VNode } from "preact";
import htm from "htm"

export const html = htm.bind(h) as (strings: TemplateStringsArray, ...values: any[]) => VNode<any>

type ResolveFn<T> = (value: T) => void
type RenderFn<T> = (resolve: ResolveFn<T>) => ComponentChild

export function renderComponent<T>(
    renderFn: RenderFn<T>
): Promise<T> {
    const cssPaths = import.meta.PLUGIN_WEB_EXT_CHUNK_CSS_PATHS
    const appContainer = document.createElement("div")
    const shadowRoot = appContainer.attachShadow({
        mode: import.meta.env.DEV ? "open" : "closed",
    })
    const appRoot = document.createElement("div")

    for (const cssPath of cssPaths) {
        const styleEl = document.createElement("link")
        styleEl.setAttribute("rel", "stylesheet")
        styleEl.setAttribute("href", browser.runtime.getURL(cssPath))
        shadowRoot.appendChild(styleEl)
    }

    return new Promise<T>((resolve) => {
        let component = renderFn(resolve)
        render(component, appRoot)
        shadowRoot.appendChild(appRoot)
        document.body.appendChild(appContainer)
    }).finally(() => appContainer.remove())
}
