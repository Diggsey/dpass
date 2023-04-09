import browser, { Menus } from "webextension-polyfill"
import { CommandId, executeCommand } from "./commands"

type ItemType = Menus.CreateCreatePropertiesType & { id: CommandId }

function createContextMenuItems(
    contexts: Menus.ContextType[],
    items: ItemType[]
) {
    for (const item of items) {
        browser.contextMenus.create({
            contexts,
            ...item,
        })
    }
}

createContextMenuItems(
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
    ]
)
browser.contextMenus.onClicked.addListener((info) => {
    executeCommand(info.menuItemId as CommandId)
})
