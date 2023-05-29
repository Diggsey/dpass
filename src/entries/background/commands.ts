import { SECURE_CONTEXT } from "./context"
import host, { CommandId } from "~/entries/shared/host"
import { onInit } from "./init"

export async function executeCommand(commandId: CommandId) {
    switch (commandId) {
        case "dpass-configure":
            await host.openOptionsPage()
            break
        case "dpass-sync":
            SECURE_CONTEXT.sync()
            break
        case "dpass-lock":
            await SECURE_CONTEXT.lock(false)
            break
        case "dpass-unlock":
            await host.requestUnlock(false)
            break
    }
}

onInit(() => {
    host.onCommand((commandId) => {
        void executeCommand(commandId as CommandId)
    })
})
