import browser from "webextension-polyfill"
import { StorageAddress } from "../../privileged/state"
import { RootAddressesChangedHandler } from ".."

const rootAddressesChangedHandlers: RootAddressesChangedHandler[] = []

export async function storeRootAddresses(
    rootAddresses: StorageAddress[]
): Promise<void> {
    await browser.storage.sync.set({ rootAddresses })
}

export async function loadRootAddresses(): Promise<StorageAddress[]> {
    const res = await browser.storage.sync.get("rootAddresses")
    return res.rootAddresses ?? []
}

export function onRootAddressesChanged(handler: RootAddressesChangedHandler) {
    rootAddressesChangedHandlers.push(handler)
}

function handleRootAddressesChanged(
    changes: Record<string, browser.Storage.StorageChange>
) {
    if (Object.hasOwn(changes, "rootAddresses")) {
        for (const handler of rootAddressesChangedHandlers) {
            handler()
        }
    }
}

browser.storage.sync.onChanged.addListener(handleRootAddressesChanged)
