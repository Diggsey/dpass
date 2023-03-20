import { useLayoutEffect, useMemo, useRef } from "react"

const useEventCallback = <A extends unknown[], R>(
    fn: (...args: A) => R
): ((...args: A) => R) => {
    const ref = useRef<(...args: A) => R>(fn)
    useLayoutEffect(() => {
        ref.current = fn
    })
    return useMemo(
        () =>
            (...args: A): R => {
                const { current } = ref
                return current(...args)
            },
        []
    )
}

export default useEventCallback
