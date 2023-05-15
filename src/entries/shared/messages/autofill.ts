import { AutofillMode } from "../autofill"
import { AutofillArgs } from "../modal"
import { VaultItemField } from "../state"

export type RequestAutofillMessage = {
    readonly id: "requestAutofill"
    readonly vaultId: string
    readonly itemId: string
}
export type PokeActiveFrameMessage = {
    readonly id: "pokeActiveFrame"
}
export type ShowItemSelectorMessage = {
    readonly id: "showItemSelector"
    readonly args: AutofillArgs
}
export type PerformAutofillMessage = {
    readonly id: "performAutofill"
    readonly item: RequestAutofillMessage
    readonly origin: string
}
export type PokeFrameResponse = {
    readonly origin: string
    readonly url: string
    readonly title: string
    readonly fields: readonly DetectedField[]
}

export type AutofillPayload = {
    readonly fields: readonly VaultItemField[]
}

export type DetectedField = {
    readonly active: boolean
    readonly autofillModes: readonly AutofillMode[]
    readonly value: string
}
