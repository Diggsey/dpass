import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"

// 5 minutes
// const SUPER_KEY_TIMEOUT = 5 * 60 * 1000
const SUPER_KEY_TIMEOUT = 15 * 1000

type TimerId = ReturnType<typeof setTimeout>

export interface ISuperKeyContext {
    _superKey: CryptoKey | null

    // Must be implemented
    _superKeyChanged(): void
}

// Handles loading and updating the setup key
export const SuperKeyContext = mixin<ISuperKeyContext>((Base) =>
    Decorated(
        class SetupKeyContext extends Base implements ISuperKeyContext {
            #superKey: CryptoKey | null = null
            #superKeyTimer: TimerId | null = null

            get _superKey() {
                return this.#superKey
            }
            set _superKey(superKey: CryptoKey | null) {
                if (superKey === this.#superKey) {
                    return
                }
                if (this.#superKeyTimer !== null) {
                    clearTimeout(this.#superKeyTimer)
                    this.#superKeyTimer = null
                }
                this.#superKey = superKey

                if (this.#superKey !== null) {
                    this.#superKeyTimer = setTimeout(() => {
                        this.#superKey = null
                        this.#superKeyTimer = null
                        this._superKeyChanged()
                    }, SUPER_KEY_TIMEOUT)
                }

                this._superKeyChanged()
            }

            _superKeyChanged() {}

            static _decorators = [abstractMethod("_superKeyChanged")] as const
        }
    )
)
