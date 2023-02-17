import { AutofillMode, customMatcher, PRESET_AUTOFILL_MAPPING, PRESET_AUTOFILL_VALUES } from "../shared/autofill";
import { addMessageListener, Message, MessageResponse, sendMessage } from "../shared/messages";
import { AutofillPayload, DetectedField, PerformAutofillMessage, PokeFrameResponse, RequestAutofillMessage, ShowItemSelectorMessage } from "../shared/messages/autofill";
import { handleModalMessage, openModal } from "./modal";

function handleMessage(message: Message): Promise<MessageResponse> | undefined {
    switch (message.id) {
        case "pokeActiveFrame": return respondIfWeAreActive()
        case "showItemSelector": return showItemSelector(message)
        case "performAutofill": return performAutofill(message)
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
function showItemSelector(message: ShowItemSelectorMessage): Promise<RequestAutofillMessage> {
    return openModal("autofillEmbed", message.args)
}

async function performAutofill(message: PerformAutofillMessage): Promise<undefined> {
    if (message.origin !== window.origin) {
        return
    }

    const allInputs = findAllInputs()
    const payload = await sendMessage(message.item)

    if (payload) {
        autofillPage(allInputs, payload)
    }
    return
}

function respondIfWeAreActive(): Promise<PokeFrameResponse> | undefined {
    // Check if we're active by looking at the type of our active element
    const activeElement = document.activeElement
    const ignoreTags = ["IFRAME", "FRAME"]
    // If there was no active element, or the active element was a frame, then
    // we're not active and we should ignore the message.
    if (activeElement == null || ignoreTags.includes(activeElement.tagName)) {
        return
    }
    const allInputs = findAllInputs()
    const inputToFill = findInputToFill(activeElement, allInputs)
    if (!inputToFill) {
        return
    }
    const fields: DetectedField[] = allInputs.map(elem => ({
        active: elem === inputToFill,
        autofillModes: categorizeInput(elem),
        value: elem.value,
    })).filter(f => f.autofillModes.length > 0)
    // We are active, so now request auto-fill for our frame
    return Promise.resolve({
        url: window.location.href,
        origin: window.origin,
        fields,
    })
}

addMessageListener(handleMessage)
