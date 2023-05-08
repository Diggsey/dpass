export let insideUserAction = false

export function userAction<P extends unknown[], R>(
    f: (...args: P) => R
): (...args: P) => R {
    return (...args) => {
        const wasInsideUserAction = insideUserAction
        try {
            insideUserAction = true
            return f(...args)
        } finally {
            insideUserAction = wasInsideUserAction
        }
    }
}
