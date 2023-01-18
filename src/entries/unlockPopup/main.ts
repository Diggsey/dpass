import { render } from "preact";
import { useEffect } from "preact/hooks";
import { usePrivilegedState } from "../shared/privileged/hooks";
import { html } from "../shared/render";
import "./style.css";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { UnlockPanel } from "../shared/components/unlockForm";

render(html`<${Popup} />`, document.body)


function Popup() {
    const state = usePrivilegedState()
    const isUnlocked = state?.isUnlocked

    useEffect(() => {
        if (isUnlocked) {
            window.close()
        }
    }, [isUnlocked])

    return html`<div><${UnlockPanel} /></div>`
}