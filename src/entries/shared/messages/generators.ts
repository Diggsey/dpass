import { GeneratorSettings } from "../state"

export type EditGeneratorSettingsMessage = {
    id: "editGeneratorSettings"
    settings: GeneratorSettings
}

export type GeneratePasswordMessage = {
    id: "generatePassword"
}
