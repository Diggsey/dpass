import browser from "webextension-polyfill"

export type CommandId = "dpass-configure" | "dpass-sync"

export function executeCommand(commandId: CommandId) {
    switch (commandId) {
        case "dpass-configure":
            void browser.runtime.openOptionsPage()
            break
    }
}

browser.commands.onCommand.addListener((commandId) => {
    executeCommand(commandId as CommandId)
})
