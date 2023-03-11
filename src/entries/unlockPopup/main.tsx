import { FunctionalComponent, render } from "preact"
import { useEffect } from "preact/hooks"
import { usePrivilegedState } from "../shared/privileged/hooks"
import "./style.css"
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { UnlockPanel } from "../shared/components/unlockForm"
import browser from "webextension-polyfill"

const Popup: FunctionalComponent = () => {
    const state = usePrivilegedState()
    const isSuper = state?.isSuper
    const isUnlocked = !!state?.isUnlocked
    const isSetUp = state?.isSetUp ?? true

    useEffect(() => {
        if (isSuper) {
            window.close()
        }
    }, [isSuper])

    return (
        <div>
            <UnlockPanel isSetUp={isSetUp} isUnlocked={isUnlocked} />
        </div>
    )
}

render(<Popup />, document.body)

const rootElem = document.body.firstElementChild as HTMLElement

new ResizeObserver(() => {
    document.body.style.width = `${rootElem.offsetWidth}px`
    document.body.style.height = `${rootElem.offsetHeight}px`
}).observe(rootElem)

if (window.location.hash !== "#popup") {
    new ResizeObserver(() => {
        const extraH = window.outerHeight - window.innerHeight
        const extraW = window.outerWidth - window.innerWidth
        const newWidth = document.body.offsetWidth + extraW
        const newHeight = document.body.offsetHeight + extraH
        void browser.windows.update(browser.windows.WINDOW_ID_CURRENT, {
            width: newWidth,
            height: newHeight,
        })
    }).observe(document.body)
}
