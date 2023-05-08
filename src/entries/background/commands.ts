import browser from "webextension-polyfill"
import { SECURE_CONTEXT } from "./context"
import { requestUnlock } from "./unlock"
import { userAction } from "./userAction"
import { onInit } from "./init"

export type CommandId =
    | "dpass-configure"
    | "dpass-sync"
    | "dpass-lock"
    | "dpass-unlock"

export async function executeCommand(commandId: CommandId) {
    switch (commandId) {
        case "dpass-configure":
            await browser.runtime.openOptionsPage()
            break
        case "dpass-sync":
            throw new Error("Not implemented")
        case "dpass-lock":
            await SECURE_CONTEXT.lock(false)
            break
        case "dpass-unlock":
            await requestUnlock(false)
            break
    }
}

onInit(() => {
    browser.commands.onCommand.addListener(
        userAction((commandId) => {
            void executeCommand(commandId as CommandId)
        })
    )
})
