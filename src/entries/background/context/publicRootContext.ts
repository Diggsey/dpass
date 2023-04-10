import { mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { RootInfo } from "../serialize/rootData"
import { itemPatcher } from "../serialize/merge"
import { IRootContext, UpdateRootHint } from "./rootContext"

export interface IPublicRootContext {
    lock(unenroll: boolean): Promise<void>
    unlock(masterPassword: string, secretSentence: string | null): Promise<void>
    createRoot(
        name: string,
        masterPassword: string,
        secretSentence: string
    ): Promise<void>
    changePassword(
        oldPassword: string,
        newPassword: string | null,
        newSentence: string | null
    ): Promise<void>
    updateRootName(name: string): Promise<void>
}

// Publishes changes to the context
export const PublicRootContext = mixin<
    IPublicRootContext,
    Actor & IRootContext
>(
    (Base) =>
        class PublicRootContext extends Base implements IPublicRootContext {
            #patchRootInfo(
                f: (rootInfo: RootInfo) => RootInfo,
                hint?: UpdateRootHint
            ): Promise<void> {
                return this._patchRoot(
                    itemPatcher((payload) => {
                        if (payload?.id === "rootInfo") {
                            return f(payload)
                        }
                        return payload
                    }),
                    hint
                )
            }
            lock(unenroll: boolean): Promise<void> {
                return this._post("lock()", () => this._encryptRoot(unenroll))
            }
            unlock(
                masterPassword: string,
                secretSentence: string | null
            ): Promise<void> {
                return this._post("unlock()", () =>
                    this._decryptRoot(masterPassword, secretSentence)
                )
            }
            createRoot(
                name: string,
                masterPassword: string,
                secretSentence: string
            ): Promise<void> {
                return this._post(
                    `createRoot(${name}, <redacted>)`,
                    async () => {
                        if (this._hasIdentity) {
                            throw new Error("Root already exists")
                        }

                        const currentTs = Date.now()
                        await this._recreateEncryptedRoot(
                            masterPassword,
                            secretSentence
                        )
                        await this._updateRoot({
                            uuid: crypto.randomUUID(),
                            items: [
                                {
                                    uuid: crypto.randomUUID(),
                                    creationTimestamp: currentTs,
                                    updateTimestamp: currentTs,
                                    payload: {
                                        id: "rootInfo",
                                        name,
                                        secretSentence,
                                    },
                                },
                            ],
                        })
                    }
                )
            }
            changePassword(
                oldPassword: string,
                newPassword: string | null,
                newSentence: string | null
            ): Promise<void> {
                return this._post(
                    "changePassword(<redacted>, <redacted>, <redacted>)",
                    async () => {
                        // Check that old password is valid
                        await this._decryptRoot(oldPassword, null)

                        const oldSentence =
                            this._rootInfo?.payload.secretSentence
                        if (oldSentence === undefined) {
                            throw new Error("Secret sentence not set")
                        }

                        await this._recreateEncryptedRoot(
                            newPassword ?? oldPassword,
                            newSentence ?? oldSentence
                        )

                        if (newSentence !== null && this._root !== null) {
                            await this.#patchRootInfo(
                                (rootInfo) => ({
                                    ...rootInfo,
                                    secretSentence: newSentence,
                                }),
                                {
                                    forceSave: true,
                                }
                            )
                        } else {
                            // Save changes to storage
                            await this._saveRootChanges()
                        }
                    }
                )
            }
            updateRootName(name: string): Promise<void> {
                return this._post(`updateRootName(${name})`, () =>
                    this.#patchRootInfo((rootInfo) => ({
                        ...rootInfo,
                        name,
                    }))
                )
            }
        }
)
