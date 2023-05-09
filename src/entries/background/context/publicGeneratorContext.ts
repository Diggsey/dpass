import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { itemPatcher } from "../serialize/merge"
import { IRootContext } from "./rootContext"
import { GeneratorSettings } from "~/entries/shared/state"
import { generatePassword, passwordEntropy } from "~/entries/shared/generator"
import { IHistoryContext } from "./historyContext"

export interface IPublicGeneratorContext {
    updateGeneratorSettings(settings: GeneratorSettings): Promise<void>
    generatePassword(): Promise<string>
}

// Publishes changes to the context
export const PublicGeneratorContext = mixin<
    IPublicGeneratorContext,
    Actor & IRootContext & IHistoryContext
>(
    (Base) =>
        class PublicGeneratorContext
            extends Base
            implements IPublicGeneratorContext
        {
            updateGeneratorSettings(
                newSettings: GeneratorSettings
            ): Promise<void> {
                return this._post(
                    `updateGeneratorSettings(${JSON.stringify(newSettings)})`,
                    () =>
                        this._patchRoot(
                            itemPatcher((payload) => {
                                if (payload?.id === "generatorSettings") {
                                    return {
                                        ...newSettings,
                                        id: "generatorSettings",
                                    }
                                } else {
                                    return payload
                                }
                            })
                        )
                )
            }

            generatePassword(): Promise<string> {
                return this._post("generatePassword()", async () => {
                    const settings = this._generatorSettings
                    if (settings === null) {
                        throw new Error("Not unlocked")
                    }
                    const password = generatePassword(settings.payload)
                    const entropy = passwordEntropy(settings.payload)

                    await this._recordHistory([
                        {
                            id: "historyEntry",
                            type: "generated",
                            value: password,
                            entropy,
                            origins: [],
                            name: "Password",
                            autofillMode: { id: "password" },
                        },
                    ])
                    return password
                })
            }
        }
)
