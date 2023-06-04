import {
    AutofillMode,
    customMatcher,
    PRESET_AUTOFILL_MAPPING,
    PRESET_AUTOFILL_VALUES,
} from "../shared/autofill"
import { Message, MessageResponse } from "../shared/messages"
import {
    AutofillPayload,
    DetectedField,
    PerformAutofillMessage,
    PokeFrameResponse,
    RequestAutofillMessage,
    ShowItemSelectorMessage,
} from "../shared/messages/autofill"
import { handleModalMessage, openModal } from "./modal"
import browser from "webextension-polyfill"

function handleMessage(message: Message): Promise<MessageResponse> | undefined {
    switch (message.id) {
        case "pokeActiveFrame":
            return respondIfWeAreActive()
        case "showItemSelector":
            return showItemSelector(message)
        case "performAutofill":
            return performAutofill(message)
        case "contentModal":
            return handleModalMessage(message)
        default:
            console.warn(`Received unknown message type: ${message.id}`)
            return
    }
}

function populateInput(elem: HTMLInputElement, value: string) {
    elem.focus()
    elem.value = value
    elem.dispatchEvent(new Event("input", { bubbles: true }))
}

// Given the details for this origin, and the active element,
// attempt to populate any appropriate input fields.
function autofillPage(
    allInputs: HTMLInputElement[],
    payload: AutofillPayload
): boolean {
    let success = false
    const candidateModes = payload.fields.map((x) => x.autofillMode)
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
        const field = payload.fields.find((f) => f.autofillMode === category)
        if (field === undefined) {
            throw new Error("Returned invalid auto-fill mode")
        }
        populateInput(elem, field.value)
        success = true
    }
    return success
}

function categorizeInput(
    elem: HTMLInputElement,
    candidates?: AutofillMode[]
): AutofillMode[] {
    return (candidates ?? PRESET_AUTOFILL_VALUES.map((id) => ({ id })))
        .map(
            (candidate) =>
                [
                    candidate,
                    candidate.id === "custom"
                        ? customMatcher(elem, candidate.key)
                        : PRESET_AUTOFILL_MAPPING[candidate.id].matcher(elem),
                ] as const
        )
        .filter((x) => x[1] > 0)
        .sort((a, b) => a[1] - b[1])
        .map((x) => x[0])
}

function findInputToFill(
    activeElement: Element,
    allInputs: HTMLInputElement[]
): HTMLInputElement | null {
    if (activeElement instanceof HTMLInputElement) {
        return activeElement
    } else {
        return allInputs[0] || null
    }
}

function isVisible(elem: HTMLInputElement): boolean {
    if (
        !(elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length)
    ) {
        return false
    }
    const style = getComputedStyle(elem)
    if (
        style.display === "none" ||
        style.visibility !== "visible" ||
        parseFloat(style.opacity) < 0.1
    ) {
        return false
    }
    return true
}

function findAllInputs(): HTMLInputElement[] {
    const inputTypes = ["email", "password", "text"]
    return Array.from(document.getElementsByTagName("input")).filter(
        (elem) => inputTypes.includes(elem.type) && isVisible(elem)
    )
}
function showItemSelector(
    message: ShowItemSelectorMessage
): Promise<RequestAutofillMessage | null> {
    return openModal("autofillEmbed", message.args)
}

async function performAutofill(
    message: PerformAutofillMessage
): Promise<boolean> {
    if (message.origin !== window.origin) {
        throw new Error("Unable to auto-fill: wrong origin")
    }

    const allInputs = findAllInputs()
    const payload = await browser.runtime.sendMessage(message.item)

    if (payload) {
        return autofillPage(allInputs, payload)
    }
    return true
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
    const fields: DetectedField[] = allInputs
        .map((elem) => ({
            active: elem === inputToFill,
            autofillModes: categorizeInput(elem),
            value: elem.value,
        }))
        .filter((f) => f.autofillModes.length > 0)
    // We are active, so now request auto-fill for our frame
    return Promise.resolve({
        url: window.location.href,
        origin: window.origin,
        title: document.title,
        fields,
    })
}

browser.runtime.onMessage.addListener(handleMessage)
