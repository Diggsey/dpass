import { FunctionalComponent } from "preact";
import { AutofillPayload } from "../../shared";
import { Modal } from "./modal"
import "./payloadSelector.css"

type OnCloseFn = (payload?: AutofillPayload) => void

const PayloadItem: FunctionalComponent<{ payload: AutofillPayload, onClose: OnCloseFn }> = ({ payload, onClose }) => {
    const onClick = () => onClose(payload)
    return <li onClick={onClick}> {payload.username} </li>
}

export const PayloadSelector: FunctionalComponent<{ payloads: AutofillPayload[], onClose: OnCloseFn }> = ({ payloads, onClose }) => (
    <Modal onClose={onClose}>
        <ul class="payload-list">
            {payloads.map(payload => <PayloadItem payload={payload} onClose={onClose} />)}
        </ul>
    </Modal>
)
