import { FunctionComponent } from "preact"
import "./modal.css"

type OnCloseFn = () => void

export const Modal: FunctionComponent<{ onClose: OnCloseFn }> = ({ children, onClose }) => (
    <div class="modal-bg" onClick={onClose}>
        <div class="modal">{children}</div>
    </div>
)
