import browser from "webextension-polyfill"
import { IStatePublisher } from "../../privileged/state"
import { BROWSER_ACTION } from "./browserAction"
import { CONTEXT_MENU } from "./contextMenus"
import { UnlockWithKeyHandler } from ".."
import { userAction } from "./userAction"
import { executeCommandInner } from "./commands"
import { DOWNLOAD_MANAGER } from "./download"
import { handleTabRemoved } from "./unlock"

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
export { requestToken } from "./tokenManager"

export async function openOptionsPage() {
    await browser.runtime.openOptionsPage()
}

export function init(background: boolean) {
    if (background) {
        browser.browserAction.onClicked.addListener(
            userAction(BROWSER_ACTION.onClick)
        )
        browser.commands.onCommand.addListener(userAction(executeCommandInner))
        browser.contextMenus.onClicked.addListener(
            userAction(CONTEXT_MENU.onClick)
        )
        browser.downloads.onChanged.addListener(DOWNLOAD_MANAGER.onChanged)
        browser.tabs.onRemoved.addListener(handleTabRemoved)
        CONTEXT_MENU.init()
    }
}

export function statePublishers(): IStatePublisher[] {
    return [BROWSER_ACTION, CONTEXT_MENU]
}

export function getAssetUrl(path: string): string {
    return browser.runtime.getURL(path)
}

export function blockRefresh(): () => void {
    return () => {}
}

export async function copyText(text: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text)
    } catch (ex) {
        console.error(ex)
    }
}

export async function rememberKey(_key: CryptoKey): Promise<void> {
    // Not supported
}

export function onUnlockWithKey(_handler: UnlockWithKeyHandler): void {
    // Not supported
}
