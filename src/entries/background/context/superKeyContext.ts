import { TimerId } from "~/entries/shared"
import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"
import { requestUnlock } from "../unlock"
import { Actor } from "../actor"

// 5 minutes
// const SUPER_KEY_TIMEOUT = 5 * 60 * 1000
const SUPER_KEY_TIMEOUT = 15 * 1000

export class MissingSuperKey extends Error {
    constructor() {
        super("Requires unlock")
    }
}

export interface ISuperKeyContext {
    _superKey: CryptoKey | null

    _requireSuperKey(): Promise<CryptoKey>
    _postWithRetryIfLocked<R>(
        name: string,
        action: () => Promise<R>
    ): Promise<R>

    // Must be implemented
    _superKeyChanged(): void
}

// Handles loading and updating the setup key
export const SuperKeyContext = mixin<ISuperKeyContext, Actor>((Base) =>
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

            async _requireSuperKey(): Promise<CryptoKey> {
                if (!this._superKey) {
                    throw new MissingSuperKey()
                }
                return this._superKey
            }

            async _postWithRetryIfLocked<R>(
                name: string,
                action: () => Promise<R>
            ): Promise<R> {
                try {
                    return await this._post(name, action)
                } catch (ex) {
                    if (!(ex instanceof MissingSuperKey)) {
                        throw ex
                    }
                    await requestUnlock()
                    if (!this._superKey) {
                        throw new Error("Failed to unlock")
                    }
                    return await this._post(name, action)
                }
            }

            _superKeyChanged() {}

            static _decorators = [abstractMethod("_superKeyChanged")] as const
        }
    )
)
