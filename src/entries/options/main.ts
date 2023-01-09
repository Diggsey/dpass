import { render } from "preact";
import { sendMessage } from "../shared";
import { usePrivilegedState } from "../shared/privileged/hooks";
import { html } from "../shared/render";
import "./style.css";

render(html`<${App} />`, document.body)

function App() {
    const state = usePrivilegedState()
    const createRoot = () => {
        const masterPassword = prompt("Enter master password:")
        if (masterPassword) {
            sendMessage({
                id: "createRoot",
                masterPassword
            })
        }
    }
    const createLocalStorage = () => {
        sendMessage({
            id: "addRootStorageAddress",
            storageAddress: {
                id: "local",
                folderName: "default",
            }
        })
    }
    return html`<div>
        <div>${JSON.stringify(state)}</div>
        <button type="button" onClick=${createRoot}>Create root</button>
        <button type="button" onClick=${createLocalStorage}>Create local storage</button>
        </div>`
}