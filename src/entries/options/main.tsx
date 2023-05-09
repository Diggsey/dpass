import { FC } from "react"
import { createRoot } from "react-dom/client"
import { usePrivilegedState } from "../shared/privileged/hooks"
import "./style.css"
import { IdentityPage } from "./identity"
import { PrivilegedState } from "../shared/privileged/state"
import { VaultsPage } from "./vaults"
import { ItemsPage } from "./items"
import { AppShell } from "../shared/components/appShell"
import { GeneratorPage } from "./generator"
import { HistoryPage } from "./history"

const AppBody: FC<{ state: PrivilegedState }> = ({ state }) => {
    const navigation = [
        {
            key: "identity",
            title: "Identity",
            body: <IdentityPage state={state} />,
        },
        {
            key: "vaults",
            title: "Vaults",
            body: <VaultsPage state={state} />,
            disabled: !state?.isUnlocked,
        },
        {
            key: "items",
            title: "Items",
            body: <ItemsPage state={state} />,
            disabled: Object.keys(state.vaults).length === 0,
        },
        {
            key: "generator",
            title: "Generator",
            body: <GeneratorPage state={state} />,
            disabled: !state?.isUnlocked,
        },
        {
            key: "history",
            title: "History",
            body: <HistoryPage state={state} />,
            disabled: !state?.isUnlocked,
        },
    ]
    return <AppShell navigation={navigation} />
}

const App: FC = () => {
    const state = usePrivilegedState()
    return state ? <AppBody state={state} /> : <div className="loader" />
}

const appRoot = createRoot(document.body)
appRoot.render(<App />)
