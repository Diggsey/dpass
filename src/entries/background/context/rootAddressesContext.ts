import {
    abstractMethod,
    Decorated,
    mixin,
    MixinConstructorArgs,
} from "~/entries/shared/mixin"
import { StorageAddress } from "~/entries/shared/privileged/state"
import { Actor } from "../actor"
import host from "~/entries/shared/host"

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

                #loadRootAddresses = () => {
                    void this._post("#loadRootAddresses()", async () => {
                        const rootAddresses = await host.loadRootAddresses()
                        await this.#updateRootAddresses(rootAddresses)
                    })
                }

                async #updateRootAddresses(rootAddresses: StorageAddress[]) {
                    this.#rootAddresses = rootAddresses
                    await this._rootAddressesChanged()
                }

                constructor(...args: MixinConstructorArgs) {
                    super(...args)
                    host.onRootAddressesChanged(this.#loadRootAddresses)
                    this.#loadRootAddresses()
                }

                async _rootAddressesChanged() {}

                static _decorators = [
                    abstractMethod("_rootAddressesChanged"),
                ] as const
            }
        )
)
