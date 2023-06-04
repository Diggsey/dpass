import browser from "webextension-polyfill"
import { insideUserAction } from "./userAction"
import { BROWSER_ACTION, BrowserClickAction } from "./browserAction"

const pendingResolvers: ((arg: void) => void)[] = []
let unlockPopupInfo: {
    windowId: number
    tabId: number
} | null = null

export const requestUnlock = async (waitForUnlock = true) => {
    const promise = waitForUnlock
        ? new Promise((resolve) => {
              pendingResolvers.push(resolve)
          })
        : Promise.resolve()
    if (unlockPopupInfo === null) {
        // If we don't need to wait for the unlock to happen, and we are in a
        // user action, then we can make use of the extension popup instead
        // of having to open a new window.
        if (
            !waitForUnlock &&
            insideUserAction &&
            BROWSER_ACTION.clickAction === BrowserClickAction.RequestPassword
        ) {
            await browser.browserAction.openPopup()
            return
        }

        const { id, tabs } = await browser.windows.create({
            url: browser.runtime.getURL("src/entries/unlockPopup/index.html"),
            type: "popup",
            width: 300,
            height: 300,
        })
        if (id === undefined || !tabs || tabs[0]?.id === undefined) {
            throw new Error("Failed to create unlock window")
        }
        unlockPopupInfo = {
            windowId: id,
            tabId: tabs[0].id,
        }
    } else {
        await browser.tabs.update(unlockPopupInfo.tabId, { active: true })
        await browser.windows.update(unlockPopupInfo.windowId, {
            focused: true,
        })
    }
    await promise
}

export function handleTabRemoved(
    tabId: number,
    _removeInfo: browser.Tabs.OnRemovedRemoveInfoType
) {
    if (unlockPopupInfo && tabId === unlockPopupInfo.tabId) {
        unlockPopupInfo = null
        let resolve = null
        while ((resolve = pendingResolvers.pop())) {
            resolve()
        }
    }
}
