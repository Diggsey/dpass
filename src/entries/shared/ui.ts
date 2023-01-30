import { Inputs, useCallback, useRef, useState } from "preact/hooks"

export type ClassName =
    | { [className: string]: boolean | null | undefined }
    | ClassName[]
    | string | null | undefined | false

function mapArg(arg: ClassName): string {
    if (!arg) {
        return ""
    }
    if (typeof arg === "string") {
        return arg
    }
    if (Array.isArray(arg)) {
        return cn(...arg)
    }
    return Object.entries(arg)
        .filter(([_, v]) => v)
        .map(([k, _]) => k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
        .join(" ")
}

export function cn(...args: ClassName[]): string {
    return args.map(mapArg).filter(Boolean).join(" ")
}

type PromiseState<R, P> = {
    readonly inProgress: true,
    readonly lastArgs: P,
    readonly lastError?: never,
    readonly lastResult?: never,
} | {
    readonly inProgress: false,
    readonly lastArgs?: P,
    readonly lastError?: unknown,
    readonly lastResult?: R,
}

type PromiseStateResult<R, F extends (...args: never[]) => Promise<R>> = [
    PromiseState<R, Parameters<F>>,
    (...args: Parameters<F>) => Promise<R>,
    () => void,
]

export function usePromiseState<R, F extends (...args: never[]) => Promise<R>>(cb: F, inputs: Inputs): PromiseStateResult<R, F> {
    const [state, setState] = useState<PromiseState<R, Parameters<F>>>({ inProgress: false })
    const inProgress = useRef(false)
    const fn = useCallback(async (...args: Parameters<F>) => {
        if (inProgress.current) {
            throw new Error("Operation already in progress")
        }
        inProgress.current = true
        setState({ inProgress: true, lastArgs: args })
        try {
            const lastResult: R = await cb(...args)
            setState(oldState => ({ ...oldState, lastResult, inProgress: false }))
            return lastResult
        } catch (lastError) {
            setState(oldState => ({ ...oldState, lastError, inProgress: false }))
            throw lastError
        } finally {
            inProgress.current = false
        }

    }, inputs)
    const clearResult = useCallback(() => {
        setState(oldState => oldState.inProgress ? oldState : { inProgress: false })
    }, [])
    return [state, fn, clearResult]
}
