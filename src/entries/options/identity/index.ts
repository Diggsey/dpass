import { FunctionalComponent } from "preact"
import { UnlockPanel } from "~/entries/shared/components/unlockForm"
import { PrivilegedState } from "~/entries/shared/privileged/state"
import { html } from "~/entries/shared/render"
import { StoragePanel } from "./storage"

export const IdentityPage: FunctionalComponent<{ state: PrivilegedState }> = ({ state }) => {
    const storagePanel = html`<${StoragePanel} state=${state} />`
    const unlockPanel = state.hasIdentity && !state.isUnlocked && html`
        <${UnlockPanel} state=${state} />
    `
    return html`
        ${storagePanel}
        ${unlockPanel}
    `
}