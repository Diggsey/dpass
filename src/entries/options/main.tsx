import { FunctionalComponent, render } from "preact";
import { sendMessage } from "../shared";
import { usePrivilegedState } from "../shared/privileged/hooks";
import "./style.css";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { Tab, Tabs } from "../shared/components/tabs";
import { IdentityPage } from "./identity";
import { PrivilegedState } from "../shared/privileged/state";
import browser from "webextension-polyfill";

const AppBody: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
    const createRoot = async () => {
        const masterPassword = prompt("Enter master password:")
        if (masterPassword) {
            await sendMessage({
                id: "createRoot",
                masterPassword
            })
        }
    }
    const createLocalStorage = async () => {
        await sendMessage({
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
    const unlock = async () => {
        const masterPassword = prompt("Enter master password:")
        if (masterPassword) {
            await sendMessage({
                id: "unlock",
                masterPassword
            })
        }
    }
    const lock = async () => {
        await sendMessage({
            id: "lock"
        })
    }

    return <>
        <Tabs class="is-large">
            <Tab title="Identity">
                <IdentityPage state={state} />
            </Tab>
            <Tab title="Vaults" isDisabled={!state?.isUnlocked}>
                Vaults Body
            </Tab>
        </Tabs>
        <div>{JSON.stringify(state)}</div>
        <button type="button" onClick={createRoot}>Create root</button>
        <button type="button" onClick={createLocalStorage}>Create local storage</button>
        <button type="button" onClick={unlock}>Unlock</button>
        <button type="button" onClick={lock}>Lock</button>
        <div>{browser.identity.getRedirectURL()}</div>
    </>

}

const App: FunctionalComponent = () => {
    const state = usePrivilegedState()
    return <div>
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
            {state ? <AppBody state={state} /> : <div class=".loader" />}
        </div>
    </div>
}

render(<App />, document.body)
