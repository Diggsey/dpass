import browser, { Menus } from "webextension-polyfill"
import { CommandId, executeCommand } from "./commands"
import { IStatePublisher } from "./pubsub/state"
import { PrivilegedState } from "../shared/privileged/state"
import { SECURE_CONTEXT } from "./context"
import { userAction } from "./userAction"
import { onInit } from "./init"

type ItemType = Menus.CreateCreatePropertiesType & { id: CommandId }
enum LockState {
    NoIdentity,
    Locked,
    Unlocked,
}

class ContextMenu extends EventTarget implements IStatePublisher {
    #lockState: LockState = LockState.NoIdentity

    set lockState(value: LockState) {
        if (value === this.#lockState) {
            return
        }
        this.#lockState = value
        void browser.contextMenus.update("dpass-lock", {
            visible: value === LockState.Unlocked,
        })
        void browser.contextMenus.update("dpass-unlock", {
            visible: value !== LockState.Unlocked,
            enabled: value === LockState.Locked,
        })
    }

    publishPrivileged(state: PrivilegedState): void {
        if (state.hasIdentity) {
            if (state.isUnlocked) {
                this.lockState = LockState.Unlocked
            } else {
                this.lockState = LockState.Locked
            }
        } else {
            this.lockState = LockState.NoIdentity
        }
    }

    createContextMenuItems(contexts: Menus.ContextType[], items: ItemType[]) {
        for (const item of items) {
            browser.contextMenus.create({
                contexts,
                ...item,
            })
        }
    }

    onClick = (info: Menus.OnClickData) => {
        void executeCommand(info.menuItemId as CommandId)
    }

    constructor() {
        super()
        this.createContextMenuItems(
            ["browser_action"],
            [
                {
                    id: "dpass-configure",
                    title: "Configure...",
                },
                {
                    id: "dpass-sync",
                    title: "Sync Now",
                    icons: {
                        "16": "icons/menu-refresh.svg",
                    },
                },
                {
                    id: "dpass-lock",
                    title: "Lock",
                    icons: {
                        "16": "icons/menu-lock.svg",
                    },
                    visible: false,
                },
                {
                    id: "dpass-unlock",
                    title: "Unlock",
                    icons: {
                        "16": "icons/menu-unlock.svg",
                    },
                    enabled: false,
                },
            ]
        )
    }
}

export const CONTEXT_MENU = new ContextMenu()

onInit(() => {
    SECURE_CONTEXT.addStatePublisher(CONTEXT_MENU)
    browser.contextMenus.onClicked.addListener(userAction(CONTEXT_MENU.onClick))
})
