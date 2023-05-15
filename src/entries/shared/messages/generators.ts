import { GeneratorSettings } from "../state"

export type EditGeneratorSettingsMessage = {
    readonly id: "editGeneratorSettings"
    readonly settings: GeneratorSettings
}

export type GeneratePasswordMessage = {
    readonly id: "generatePassword"
}
