import { Message, AutofillPayload, sendMessage } from "../shared";
import browser from "webextension-polyfill";
import { renderComponent } from "./render";
import { PayloadSelector } from "./components/payloadSelector";
import { html } from "../shared/render";


function handleMessage(message: Message) {
    switch (message.id) {
        case "pokeActiveFrame": return respondIfWeAreActive()
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
function autofillPage(activeElement: Element, payload: AutofillPayload) {
    // Only consider these input types
    const inputTypes = ["email", "password", "submit", "text"]

    // Find every input on the page of the appropriate type
    let allInputs = Array.from(document.getElementsByTagName('input')).filter(elem => inputTypes.includes(elem.type))

    // Initially, assume there is no username or password input present
    let usernameInput = null
    let passwordInput = null

    // If the active element is one of our inputs, assume the user already focused
    // one of the fields they want to populate.
    if (activeElement instanceof HTMLInputElement) {
        const activeIdx = allInputs.indexOf(activeElement)
        if (activeIdx !== -1) {
            if (activeElement.type === "password") {
                // If it's a password input, we need only consider other inputs
                // before this one in the page.
                passwordInput = activeElement
                allInputs = allInputs.slice(0, activeIdx)
            } else {
                // if this is not a password input, only consider later inputs
                // for password candidates.
                usernameInput = activeElement
                allInputs = allInputs.slice(activeIdx + 1)
            }
        }
    }

    // If we don't have our password input yet, pick the first input of that type
    if (passwordInput == null) {
        const passwordIdx = allInputs.findIndex(elem => elem.type === "password")
        if (passwordIdx !== -1) {
            // Only consider username fields before this one
            passwordInput = allInputs[passwordIdx]
            allInputs = allInputs.slice(0, passwordIdx)
        }
    }
    // If we found a password field, but no username field, assume the username
    // is immediately before the password.
    if (usernameInput == null && passwordInput != null && allInputs.length > 0) {
        usernameInput = allInputs[allInputs.length - 1]
    }

    // If we found the username field and have a value for it, populate it
    if (usernameInput != null && payload.username != null) {
        populateInput(usernameInput, payload.username)
    }
    // If we found the password field and have a value for it, populate it
    if (passwordInput != null && payload.password != null) {
        populateInput(passwordInput, payload.password)
    }

    // Return success if we found either field
    return usernameInput != null || passwordInput != null
}


function showPayloadSelector(payloads: AutofillPayload[]) {
    return renderComponent(resolve => html`<${PayloadSelector} payloads=${payloads} onClose=${resolve} />`)
}


async function respondIfWeAreActive() {
    // Check if we're active by looking at the type of our active element
    const activeElement = document.activeElement
    const ignoreTags = ["IFRAME", "FRAME"]
    // If there was no active element, or the active element was a frame, then
    // we're not active and we should ignore the message.
    if (activeElement == null || ignoreTags.includes(activeElement.tagName)) {
        return
    }
    // We are active, so now request auto-fill for our frame
    const payloads = await sendMessage({ id: "requestAutofill" })
    if (!payloads) {
        return
    }

    let payload
    if (payloads.length > 1) {
        payload = await showPayloadSelector(payloads)
    } else {
        payload = payloads[0]
    }
    if (!payload) {
        return
    }

    return autofillPage(activeElement, payload)
}

browser.runtime.onMessage.addListener(handleMessage)
