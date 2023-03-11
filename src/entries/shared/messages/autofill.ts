import { AutofillMode } from "../autofill"
import { AutofillArgs } from "../modal"
import { VaultItemField } from "../state"

export type RequestAutofillMessage = {
    id: "requestAutofill"
    vaultId: string
    itemId: string
}
export type PokeActiveFrameMessage = {
    id: "pokeActiveFrame"
    manual: boolean
}
export type ShowItemSelectorMessage = {
    id: "showItemSelector"
    args: AutofillArgs
}
export type PerformAutofillMessage = {
    id: "performAutofill"
    item: RequestAutofillMessage
    origin: string
}
export type PokeFrameResponse = {
    origin: string
    url: string
    fields: DetectedField[]
}

export interface AutofillPayload {
    fields: VaultItemField[]
}

export type DetectedField = {
    active: boolean
    autofillModes: AutofillMode[]
    value: string
}
