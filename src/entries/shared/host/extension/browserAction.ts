import {
    IStatePublisher,
    PrivilegedState,
    PrivilegedVaultMap,
} from "../../privileged/state"
import browser, { Action, Tabs } from "webextension-polyfill"
import { sendMessageToFrame, sendMessageToTab } from "./messages"
import {
    PokeFrameResponse,
    RequestAutofillMessage,
} from "../../messages/autofill"
import { TimerId } from "../.."

export enum BrowserClickAction {
    Autofill,
    RequestPassword,
    ShowOptions,
    None,
}

class TimeoutError extends Error {
    constructor() {
        super("Timeout")
    }
}

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timerId: TimerId
    return Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
            timerId = setTimeout(() => {
                reject(new TimeoutError())
            }, ms)
        }),
    ]).finally(() => clearTimeout(timerId))
}

class BrowserAction extends EventTarget implements IStatePublisher {
    #popup: string | null = null
    #clickAction: BrowserClickAction = BrowserClickAction.ShowOptions
    #changingPopup: Promise<void> | null = null
    #vaults: PrivilegedVaultMap = {}

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
        this.#vaults = state.vaults
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
        for (const [vaultId, vault] of Object.entries(this.#vaults)) {
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

    async pokeFrame(
        tabId: number,
        frameId: number
    ): Promise<PokeFrameResponse> {
        // Make sure our content script has been injected. We can't directly trigger
        // anything via this injection because it will have no effect on the second injection.
        await timeoutPromise(
            browser.scripting.executeScript({
                target: {
                    tabId,
                    frameIds: [frameId],
                },
                files: ["/src/entries/content/main.js"],
                injectImmediately: true,
            }),
            500
        )
        const response = await sendMessageToTab(tabId, {
            id: "pokeActiveFrame",
        })
        if (response === undefined) {
            throw new Error("Frame not active")
        }
        return response
    }

    async beginAutofillAction(tabId: number, manual: boolean) {
        const frames = await browser.webNavigation.getAllFrames({ tabId })
        let response
        try {
            // Some frames hang when we attempt to inject a script, so inject into
            // each frame individually, and race to find the active frame.
            console.log("Injecting dpass content script...")
            response = await Promise.any(
                frames.map((f) => this.pokeFrame(tabId, f.frameId))
            )
        } catch (ex) {
            console.error("Failed to inject content script: ", ex)
            return
        }

        if (!manual) {
            console.log("Looking for default autofill item...")
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
            console.log("No default item found.")
        }

        // Repeat if the first attempt was not manual, and did not result
        // in any changes.
        console.log("Opening item selector modal...")
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
