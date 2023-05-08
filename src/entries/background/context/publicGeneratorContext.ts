import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { chainPatches, itemCreator, itemPatcher } from "../serialize/merge"
import { IRootContext } from "./rootContext"
import { GeneratorSettings } from "~/entries/shared/state"
import { generatePassword, passwordEntropy } from "~/entries/shared/generator"
import { DAY } from "~/entries/shared/time"

export interface IPublicGeneratorContext {
    updateGeneratorSettings(settings: GeneratorSettings): Promise<void>
    generatePassword(): Promise<string>
}

// Publishes changes to the context
export const PublicGeneratorContext = mixin<
    IPublicGeneratorContext,
    Actor & IRootContext
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

                    // Only keep generated passwords from the last week
                    const cutOff = Date.now() - 7 * DAY
                    await this._patchRoot(
                        chainPatches(
                            // Add the newly generated password
                            itemCreator({
                                id: "generatedValue",
                                type: "password",
                                value: password,
                                entropy,
                            }),
                            // Delete old passwords
                            itemPatcher((payload, _id, updateTimestamp) => {
                                if (
                                    payload?.id === "generatedValue" &&
                                    updateTimestamp < cutOff
                                ) {
                                    return null
                                } else {
                                    return payload
                                }
                            })
                        )
                    )
                    return password
                })
            }
        }
)
