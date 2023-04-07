import { FC, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { usePrivilegedState } from "../shared/privileged/hooks"
import "./style.css"
import { UnlockPanel } from "../shared/components/unlockForm"
import browser from "webextension-polyfill"
import { useElementSize } from "../shared/ui/hooks"

const Popup: FC = () => {
    const state = usePrivilegedState()
    const isSuper = state?.isSuper
    const isUnlocked = !!state?.isUnlocked
    const isSetUp = state?.isSetUp ?? true

    useEffect(() => {
        if (isSuper) {
            window.close()
        }
    }, [isSuper])

    const [sizeRef, size] = useElementSize()
    if (size.height !== null) {
        document.body.style.width = `${size.width ?? 0}px`
        document.body.style.height = `${size.height ?? 0}px`
    }

    return (
        <div ref={sizeRef}>
            <UnlockPanel isSetUp={isSetUp} isUnlocked={isUnlocked} />
        </div>
    )
}

const root = createRoot(document.body)
root.render(<Popup />)

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
