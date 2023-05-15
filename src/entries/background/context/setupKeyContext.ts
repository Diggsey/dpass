import {
    abstractMethod,
    Decorated,
    mixin,
    MixinConstructorArgs,
} from "~/entries/shared/mixin"
import { Actor } from "../actor"
import host, { PersistentKeyType } from "~/entries/shared/host"

export interface ISetupKeyContext {
    _setupKey: CryptoKey | null

    // Must be implemented
    _setupKeyChanged(): void
}

// Handles loading and updating the setup key
export const SetupKeyContext = mixin<ISetupKeyContext, Actor>((Base) =>
    Decorated(
        class SetupKeyContext extends Base implements ISetupKeyContext {
            #setupKey: CryptoKey | null = null

            get _setupKey() {
                return this.#setupKey
            }
            set _setupKey(setupKey: CryptoKey | null) {
                if (setupKey === this.#setupKey) {
                    return
                }
                if (setupKey) {
                    void host.storeKey(PersistentKeyType.setupKey, setupKey)
                } else if (setupKey === null) {
                    void host.deleteKey(PersistentKeyType.setupKey)
                }
                this.#setupKey = setupKey
                this._setupKeyChanged()
            }

            #loadSetupKey() {
                void this._post("#loadSetupKey()", async () => {
                    const setupKey = await host.loadKey(
                        PersistentKeyType.setupKey
                    )
                    if (setupKey) {
                        this.#setupKey = setupKey
                        this._setupKeyChanged()
                    }
                })
            }

            constructor(...args: MixinConstructorArgs) {
                super(...args)
                this.#loadSetupKey()
            }

            _setupKeyChanged() {}

            static _decorators = [abstractMethod("_setupKeyChanged")] as const
        }
    )
)
