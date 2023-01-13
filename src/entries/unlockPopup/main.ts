import { render } from "preact";
import { useEffect } from "preact/hooks";
import { sendMessage } from "../shared";
import { usePrivilegedState } from "../shared/privileged/hooks";
import { html } from "../shared/render";
import "./style.css";

render(html`<${Popup} />`, document.body)


function Popup() {
    const state = usePrivilegedState()
    const isUnlocked = state?.hasRoot

    useEffect(() => {
        if (isUnlocked) {
            window.close()
        }
    }, [isUnlocked])

    const unlock = (e: Event) => {
        e.preventDefault()
        const formData = new FormData(e.target as HTMLFormElement)
        const masterPassword = formData.get("masterPassword") as string
        if (masterPassword) {
            sendMessage({
                id: "unlock",
                masterPassword
            })
        }
    }
    return html`<div>
        <form className="passwordForm" onsubmit=${unlock}>
            <label for="masterPassword">Enter master password:</label>
            <input type="password" id="masterPassword" name="masterPassword" autofocus />
        </form>
    </div>`
}