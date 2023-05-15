import browser from "webextension-polyfill"
import { IStatePublisher } from "../../privileged/state"
import { BROWSER_ACTION } from "./browserAction"
import { CONTEXT_MENU } from "./contextMenus"

export { requestUnlock } from "./unlock"
export { executeCommand, onCommand } from "./commands"
export { beginDownload } from "./download"
export {
    onMessage,
    onConnect,
    isTrusted,
    connect,
    sendMessage,
    sendMessageToFrame,
} from "./messages"
export { loadKey, storeKey, deleteKey } from "./persistentKeys"
export {
    storeRootAddresses,
    loadRootAddresses,
    onRootAddressesChanged,
} from "./rootAddresses"
export { storeToken, loadToken } from "./tokens"
export { getRedirectURL, launchWebAuthFlow } from "./webAuthFlow"

export async function openOptionsPage() {
    await browser.runtime.openOptionsPage()
}

export function init(): IStatePublisher[] {
    return [BROWSER_ACTION, CONTEXT_MENU]
}

export function getAssetUrl(path: string): string {
    return browser.runtime.getURL(path)
}
