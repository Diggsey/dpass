import browser from "webextension-polyfill"

const pendingResolvers: ((arg: void) => void)[] = []
let unlockPopupInfo: {
    windowId: number,
    tabId: number,
} | null = null

export const requestUnlock = async () => {
    const promise = new Promise(resolve => {
        pendingResolvers.push(resolve)
    })
    if (unlockPopupInfo === null) {
        const { id, tabs } = await browser.windows.create({
            url: browser.runtime.getURL("src/entries/unlockPopup/index.html"),
            type: "popup",
            width: 400,
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
        await browser.windows.update(unlockPopupInfo.windowId, { focused: true })
    }
    await promise
}

function handleTabRemoved(tabId: number, _removeInfo: browser.Tabs.OnRemovedRemoveInfoType) {
    if (unlockPopupInfo && tabId === unlockPopupInfo.tabId) {
        unlockPopupInfo = null
        let resolve = null
        while ((resolve = pendingResolvers.pop())) {
            resolve()
        }
    }
}

browser.tabs.onRemoved.addListener(handleTabRemoved)