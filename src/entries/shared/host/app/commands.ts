import { CommandHandler, CommandId } from "../../host"

const commandHandlers: CommandHandler[] = []

function executeCommandInner(commandId: string) {
    for (const f of commandHandlers) {
        f(commandId)
    }
}

export function onCommand(f: CommandHandler) {
    commandHandlers.push(f)
}

export function executeCommand(commandId: CommandId) {
    executeCommandInner(commandId)
}
