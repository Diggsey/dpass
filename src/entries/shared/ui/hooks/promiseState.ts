import { DependencyList, useCallback, useRef, useState } from "react"

export type PromiseState<R, P> =
    | {
          readonly inProgress: true
          readonly lastArgs: P
          readonly lastError?: never
          readonly lastResult?: never
      }
    | {
          readonly inProgress: false
          readonly lastArgs?: P
          readonly lastError?: unknown
          readonly lastResult?: R
      }

type PromiseStateResult<R, P extends unknown[]> = [
    PromiseState<R, P>,
    (...args: P) => Promise<R>,
    () => void
]

export type SharedPromiseState = {
    readonly inProgress: boolean
    readonly lastError?: unknown
    readonly wrap: <R, P extends unknown[]>(
        f: (...args: P) => Promise<R>
    ) => (...args: P) => Promise<R>
    readonly clearError: () => void
}

export function useSharedPromiseState(inheritState?: {
    inProgress?: boolean
    lastError?: unknown
}): SharedPromiseState {
    const inProgress = useRef(false)
    const wrap = useCallback(
        <R, P extends unknown[]>(
                f: (...args: P) => Promise<R>
            ): ((...args: P) => Promise<R>) =>
            async (...args: P) => {
                if (inProgress.current) {
                    throw new Error("Operation already in progress")
                }
                inProgress.current = true
                setState(({ lastError: _, ...oldState }) => ({
                    ...oldState,
                    inProgress: inProgress.current,
                }))
                try {
                    return await f(...args)
                } catch (lastError) {
                    setState((oldState) => ({ ...oldState, lastError }))
                    throw lastError
                } finally {
                    inProgress.current = false
                    setState((oldState) => ({
                        ...oldState,
                        inProgress: inProgress.current,
                    }))
                }
            },
        []
    )
    const clearError = useCallback(() => {
        setState(({ lastError: _, ...oldState }) => oldState)
    }, [])
    const [state, setState] = useState<SharedPromiseState>({
        inProgress: false,
        wrap,
        clearError,
    })
    return {
        ...state,
        inProgress: inheritState?.inProgress || state.inProgress,
        lastError: state.lastError || inheritState?.lastError,
    }
}

export function usePromiseState<R, P extends unknown[]>(
    cb: (...args: P) => Promise<R>,
    inputs: DependencyList,
    parent?: SharedPromiseState
): PromiseStateResult<R, P> {
    const [state, setState] = useState<PromiseState<R, P>>({
        inProgress: false,
    })
    const inProgress = useRef(false)
    const fnImpl = async (...args: P) => {
        if (inProgress.current) {
            throw new Error("Operation already in progress")
        }
        inProgress.current = true
        setState({ inProgress: true, lastArgs: args })
        try {
            const lastResult: R = await cb(...args)
            setState((oldState) => ({
                ...oldState,
                lastResult,
                inProgress: false,
            }))
            return lastResult
        } catch (lastError) {
            setState((oldState) => ({
                ...oldState,
                lastError,
                inProgress: false,
            }))
            throw lastError
        } finally {
            inProgress.current = false
        }
    }
    const fn = useCallback(parent ? parent.wrap(fnImpl) : fnImpl, [
        ...inputs,
        parent?.wrap,
    ])
    const clearResult = useCallback(() => {
        setState((oldState) =>
            oldState.inProgress ? oldState : { inProgress: false }
        )
        parent?.clearError()
    }, [parent?.clearError])
    return [state, fn, clearResult]
}
