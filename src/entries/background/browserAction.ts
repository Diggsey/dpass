import { PrivilegedState } from "../shared/privileged/state"
import { IStatePublisher } from "./pubsub/state"
import browser, { Action, Tabs } from "webextension-polyfill"
import { SECURE_CONTEXT } from "./context"
import { sendMessageToFrame, sendMessageToTab } from "../shared/messages"
import { RequestAutofillMessage } from "../shared/messages/autofill"
import { userAction } from "./userAction"
import { onInit } from "./init"

export enum BrowserClickAction {
    Autofill,
    RequestPassword,
    ShowOptions,
    None,
}

class BrowserAction extends EventTarget implements IStatePublisher {
    #popup: string | null = null
    #clickAction: BrowserClickAction = BrowserClickAction.ShowOptions
    #changingPopup: Promise<void> | null = null

    async #changePopup(popup: string | null) {
        while (this.#changingPopup) {
            await this.#changingPopup
        }
        let resolveFn = () => {}
        this.#changingPopup = new Promise((resolve) => {
            resolveFn = resolve
        })
        try {
            await browser.browserAction.setPopup({ popup })
        } finally {
            this.#changingPopup = null
            resolveFn()
        }
    }

    get _popup(): string | null {
        return this.#popup
    }
    set _popup(popup: string | null) {
        if (this.#popup !== popup) {
            this.#popup = popup
            void this.#changePopup(popup)
        }
    }

    get clickAction(): BrowserClickAction {
        return this.#clickAction
    }
    set clickAction(clickAction: BrowserClickAction) {
        if (this.#clickAction !== clickAction) {
            this.#clickAction = clickAction
            if (clickAction === BrowserClickAction.RequestPassword) {
                this._popup = "src/entries/unlockPopup/index.html#popup"
            } else {
                this._popup = null
            }
        }
    }

    publishPrivileged(state: PrivilegedState): void {
        if (!state.hasIdentity) {
            this.clickAction = BrowserClickAction.ShowOptions
        } else if (!state.isUnlocked) {
            this.clickAction = BrowserClickAction.RequestPassword
        } else {
            this.clickAction = BrowserClickAction.Autofill
        }
    }

    onClick = (tab: Tabs.Tab, info: Action.OnClickData | undefined) => {
        let clickAction = this.clickAction
        if (info?.button === 1) {
            clickAction = BrowserClickAction.ShowOptions
        }
        switch (clickAction) {
            case BrowserClickAction.Autofill:
                if (tab.id !== undefined) {
                    void this.beginAutofillAction(
                        tab.id,
                        info?.modifiers?.includes("Shift") ?? false
                    )
                } else {
                    throw new Error("Not implemented")
                }
                break

            case BrowserClickAction.ShowOptions:
                void browser.runtime.openOptionsPage()
                break
            case BrowserClickAction.RequestPassword:
            case BrowserClickAction.None:
                void browser.browserAction.openPopup()
                break
        }
    }

    async findDefaultItem(
        origin: string
    ): Promise<RequestAutofillMessage | null> {
        const candidates: RequestAutofillMessage[] = []
        for (const [vaultId, vault] of Object.entries(
            SECURE_CONTEXT.privilegedState.vaults
        )) {
            if (vault.items === null) {
                continue
            }
            for (const [itemId, item] of Object.entries(vault.items)) {
                if (item.origins.includes(origin)) {
                    candidates.push({ id: "requestAutofill", vaultId, itemId })
                }
            }
        }
        if (candidates.length === 1) {
            return candidates[0]
        } else {
            return null
        }
    }

    async beginAutofillAction(tabId: number, manual: boolean) {
        // Make sure our content script has been injected. We can't directly trigger
        // anything via this injection because it will have no effect on the second injection.
        await browser.scripting.executeScript({
            target: {
                allFrames: true,
                tabId,
            },
            files: ["/src/entries/content/main.js"],
            injectImmediately: true,
        })
        // We don't know which frame is active, so send a message to all of them.
        // Only the active frame will request auto-fill.
        const response = await sendMessageToTab(tabId, {
            id: "pokeActiveFrame",
        })
        if (response === undefined) {
            console.warn("No active frame found")
            return
        }

        if (!manual) {
            const defaultItem = await this.findDefaultItem(response.origin)
            if (defaultItem !== null) {
                const success = await sendMessageToTab(tabId, {
                    id: "performAutofill",
                    item: defaultItem,
                    origin: response.origin,
                })
                if (success !== false) {
                    return
                }
            }
        }

        // Repeat if the first attempt was not manual, and did not result
        // in any changes.
        const item = await sendMessageToFrame(tabId, 0, {
            id: "showItemSelector",
            args: {
                ...response,
            },
        })
        if (!item) {
            return
        }
        await sendMessageToTab(tabId, {
            id: "performAutofill",
            item,
            origin: response.origin,
        })
    }
}

export const BROWSER_ACTION = new BrowserAction()

onInit(() => {
    SECURE_CONTEXT.addStatePublisher(BROWSER_ACTION)
    browser.browserAction.onClicked.addListener(
        userAction(BROWSER_ACTION.onClick)
    )
})
