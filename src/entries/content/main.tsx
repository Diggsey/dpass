import { addMessageListener, AutofillPayload, Message, MessageResponse, RequestAutofillMessage, sendMessage } from "../shared";
import { AutofillMode, customMatcher, PRESET_AUTOFILL_MAPPING, PRESET_AUTOFILL_VALUES } from "../shared/autofill";
import { handleModalMessage, openModal } from "./modal";

function handleMessage(message: Message): Promise<MessageResponse> | undefined {
    switch (message.id) {
        case "pokeActiveFrame": return respondIfWeAreActive()
        case "contentModal": return handleModalMessage(message)
        default:
            console.warn(`Received unknown message type: ${message.id}`)
            return
    }
}

function populateInput(elem: HTMLInputElement, value: string) {
    elem.focus()
    elem.value = value
    elem.dispatchEvent(new Event('input', { 'bubbles': true }));
}

// Given the details for this origin, and the active element,
// attempt to populate any appropriate input fields.
function autofillPage(allInputs: HTMLInputElement[], payload: AutofillPayload) {
    const candidateModes = payload.fields.map(x => x.autofillMode)
    for (const elem of allInputs) {
        if (elem.value.trim().length > 0) {
            // Don't overwrite existing values
            continue
        }
        const category = categorizeInput(elem, candidateModes)[0]
        if (category === undefined) {
            // Don't know how to auto-fill
            continue
        }
        const field = payload.fields.find(f => f.autofillMode === category)
        if (field === undefined) {
            throw new Error("Returned invalid auto-fill mode")
        }
        populateInput(elem, field.value)
    }
}

function categorizeInput(elem: HTMLInputElement, candidates?: AutofillMode[]): AutofillMode[] {
    return (candidates ?? PRESET_AUTOFILL_VALUES.map(id => ({ id }))).map(candidate =>
        [candidate, candidate.id === "custom"
            ? customMatcher(elem, candidate.key)
            : PRESET_AUTOFILL_MAPPING[candidate.id].matcher(elem)] as const
    )
        .filter(x => x[1] > 0)
        .sort((a, b) => a[1] - b[1])
        .map(x => x[0])
}

function findInputToFill(activeElement: Element, allInputs: HTMLInputElement[]): HTMLInputElement | null {
    if (activeElement instanceof HTMLInputElement) {
        return activeElement
    } else {
        return allInputs[0] || null
    }
}

function findAllInputs(): HTMLInputElement[] {
    const inputTypes = ["email", "password", "text"]
    return Array.from(document.getElementsByTagName('input')).filter(elem => inputTypes.includes(elem.type))
}

async function beginAutofill(activeElement: Element): Promise<boolean> {
    const allInputs = findAllInputs()
    const inputToFill = findInputToFill(activeElement, allInputs)
    if (!inputToFill) {
        return false
    }
    const categories = categorizeInput(inputToFill)
    const req: RequestAutofillMessage = await openModal("autofillEmbed", {
        origin: window.origin,
        url: window.location.href,
        categories,
    })
    const payload = await sendMessage(req)

    if (payload) {
        autofillPage(allInputs, payload)
        return true
    } else {
        return false
    }
}

function respondIfWeAreActive() {
    // Check if we're active by looking at the type of our active element
    const activeElement = document.activeElement
    const ignoreTags = ["IFRAME", "FRAME"]
    // If there was no active element, or the active element was a frame, then
    // we're not active and we should ignore the message.
    if (activeElement == null || ignoreTags.includes(activeElement.tagName)) {
        return
    }
    // We are active, so now request auto-fill for our frame
    return beginAutofill(activeElement)
}

addMessageListener(handleMessage)
