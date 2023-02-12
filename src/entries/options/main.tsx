import { FunctionalComponent, render } from "preact";
import { usePrivilegedState } from "../shared/privileged/hooks";
import "./style.css";
import "bulma/bulma.sass"
import "@fortawesome/fontawesome-free/css/all.css"
import { Tab, Tabs } from "../shared/components/tabs";
import { IdentityPage } from "./identity";
import { PrivilegedState } from "../shared/privileged/state";
import { VaultsPage } from "./vaults";
import { ItemsPage } from "./items";

const AppBody: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
    return <>
        <Tabs class="is-large">
            <Tab title="Identity">
                <IdentityPage state={state} />
            </Tab>
            <Tab title="Vaults" isDisabled={!state?.isUnlocked}>
                <VaultsPage state={state} />
            </Tab>
            <Tab title="Items" isDisabled={Object.keys(state.vaults).length === 0}>
                <ItemsPage state={state} />
            </Tab>
        </Tabs>
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
            {state ? <AppBody state={state} /> : <div class="loader" />}
        </div>
    </div>
}

render(<App />, document.body)
