import { FunctionalComponent } from "preact";
import { html } from "~/entries/shared/render";
import { AutofillPayload } from "../../shared";
import { Modal } from "./modal"
import "./payloadSelector.css"

type OnCloseFn = (payload?: AutofillPayload) => void

const PayloadItem: FunctionalComponent<{ payload: AutofillPayload, onClose: OnCloseFn }> = ({ payload, onClose }) => {
    const onClick = () => onClose(payload)
    return html`<li onClick=${onClick}> ${payload.username} </li>`
}

export const PayloadSelector: FunctionalComponent<{ payloads: AutofillPayload[], onClose: OnCloseFn }> = ({ payloads, onClose }) => (
    html`
    <${Modal} onClose=${onClose}>
        <ul class="payload-list">
            ${payloads.map(payload => html`<${PayloadItem} payload=${payload} onClose=${onClose} />`)}
        </ul>
    <//>
    `
)
