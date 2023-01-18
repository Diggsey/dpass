import { FunctionalComponent, render } from "preact";
import { sendMessage } from "../shared";
import { usePrivilegedState } from "../shared/privileged/hooks";
import { html } from "../shared/render";
import "./style.css";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { Tab, Tabs } from "../shared/components/tabs";
import { IdentityPage } from "./identity";
import { PrivilegedState } from "../shared/privileged/state";
import browser from "webextension-polyfill";

render(html`<${App} />`, document.body)

const AppBody: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
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
            id: "editRootStorageAddresses",
            action: {
                id: "add",
                storageAddress: {
                    id: "local",
                    folderName: "default",
                }
            }
        })
    }
    const unlock = () => {
        const masterPassword = prompt("Enter master password:")
        if (masterPassword) {
            sendMessage({
                id: "unlock",
                masterPassword
            })
        }
    }
    const lock = () => {
        sendMessage({
            id: "lock"
        })
    }

    return html`
        <${Tabs} class="is-large">
            <${Tab} title="Identity">
                <${IdentityPage} state=${state} />
            </>
            <${Tab} title="Vaults" isDisabled=${!state?.isUnlocked}>
                Vaults Body
            </>
        </>
        <div>${JSON.stringify(state)}</div>
        <button type="button" onClick=${createRoot}>Create root</button>
        <button type="button" onClick=${createLocalStorage}>Create local storage</button>
        <button type="button" onClick=${unlock}>Unlock</button>
        <button type="button" onClick=${lock}>Lock</button>
        <div>${browser.identity.getRedirectURL()}</div>
    `
}

function App() {
    const state = usePrivilegedState()
    return html`<div>
        <section class="hero is-primary">
            <div class="hero-body">
                <p class="title">
                dpass
                </p>
                <p class="subtitle">
                Diggsey's Password Manager
                </p>
            </div>
        </section>
        <div class="column">
            ${state ? html`<${AppBody} state=${state} />` : html!`<div class=".loader" />`}
        </div>
    </div>`
}