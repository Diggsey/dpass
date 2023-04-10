import browser from "webextension-polyfill"
import {
    abstractMethod,
    Decorated,
    mixin,
    MixinConstructorArgs,
} from "~/entries/shared/mixin"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { Actor } from "../actor"

export interface IRootAddressesContext {
    get _rootAddresses(): readonly StorageAddress[]

    // Must be implemented
    _rootAddressesChanged(): Promise<void>
}

// Handles loading and updating the setup key
export const RootAddressesContext = mixin<IRootAddressesContext, Actor>(
    (Base) =>
        Decorated(
            class RootAddressesContext
                extends Base
                implements IRootAddressesContext
            {
                #rootAddresses: StorageAddress[] = []

                get _rootAddresses(): readonly StorageAddress[] {
                    return this.#rootAddresses
                }

                #loadRootAddresses() {
                    void this._post("#loadRootAddresses()", async () => {
                        const res = await browser.storage.sync.get(
                            "rootAddresses"
                        )
                        if (res.rootAddresses) {
                            await this.#updateRootAddresses(res.rootAddresses)
                        }
                    })
                }

                async #updateRootAddresses(rootAddresses: StorageAddress[]) {
                    this.#rootAddresses = rootAddresses
                    await this._rootAddressesChanged()
                }

                #syncStorageChanged = (
                    changes: Record<string, browser.Storage.StorageChange>
                ) => {
                    if (Object.hasOwn(changes, "rootAddresses")) {
                        this.#loadRootAddresses()
                    }
                }

                constructor(...args: MixinConstructorArgs) {
                    super(...args)
                    browser.storage.sync.onChanged.addListener(
                        this.#syncStorageChanged
                    )
                    this.#loadRootAddresses()
                }

                async _rootAddressesChanged() {}

                static _decorators = [
                    abstractMethod("_rootAddressesChanged"),
                ] as const
            }
        )
)
