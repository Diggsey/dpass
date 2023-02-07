import { PrivilegedState } from "../shared/privileged/state";
import { IStatePublisher } from "./pubsub/state";
import browser, { Action, Tabs } from "webextension-polyfill";
import { SECURE_CONTEXT } from "./context";
import { sendMessageToTab } from "../shared";

type BrowserClickAction = "autofill" | "requestPassword" | "showOptions" | "none"

class BrowserAction extends EventTarget implements IStatePublisher {
    #popup: string | null = null
    #clickAction: BrowserClickAction = "showOptions"
    #changingPopup: Promise<void> | null = null

    async #changePopup(popup: string | null) {
        while (this.#changingPopup) {
            await this.#changingPopup
        }
        let resolveFn = () => { }
        this.#changingPopup = new Promise(resolve => {
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

    get _clickAction(): BrowserClickAction {
        return this.#clickAction
    }
    set _clickAction(clickAction: BrowserClickAction) {
        if (this.#clickAction !== clickAction) {
            this.#clickAction = clickAction
            if (clickAction === "requestPassword") {
                this._popup = "src/entries/unlockPopup/index.html"
            } else {
                this._popup = null
            }
        }
    }

    publishPrivileged(state: PrivilegedState): void {
        if (!state.hasIdentity) {
            this._clickAction = "showOptions"
        } else if (!state.isUnlocked) {
            this._clickAction = "requestPassword"
        } else {
            this._clickAction = "autofill"
        }
    }

    onClick = (tab: Tabs.Tab, info: Action.OnClickData | undefined) => {
        let clickAction = this._clickAction
        if (info?.button === 1 || info?.modifiers?.length === 1) {
            clickAction = "showOptions"
        }
        switch (clickAction) {
            case "autofill":
                if (tab.id !== undefined) {
                    void this.beginAutofillAction(tab.id)
                } else {
                    throw new Error("Not implemented")
                }
                break;

            case "showOptions":
                void browser.runtime.openOptionsPage()
                break;
            case "requestPassword":
            case "none":
                void browser.browserAction.openPopup()
                break;
        }
    }

    async beginAutofillAction(tabId: number) {
        // Make sure our content script has been injected. We can't directly trigger
        // anything via this injection because it will have no effect on the second injection.
        await browser.scripting.executeScript({
            target: {
                allFrames: true,
                tabId,
            },
            files: ["/src/entries/content/main.js"],
            injectImmediately: true
        })
        // We don't know which frame is active, so send a message to all of them.
        // Only the active frame will request auto-fill.
        const response = await sendMessageToTab(tabId, { id: "pokeActiveFrame" })
        if (response === undefined) {
            console.warn("No active frame found")
        }
    }

}

export const BROWSER_ACTION = new BrowserAction()

SECURE_CONTEXT.addStatePublisher(BROWSER_ACTION)
browser.browserAction.onClicked.addListener(BROWSER_ACTION.onClick)
