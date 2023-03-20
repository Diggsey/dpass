import { useCallback, useMemo, useRef, useState } from "react"

type Size = {
    width: number | null
    height: number | null
}

function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
    (node: T | null) => void,
    Size
] {
    const ref = useRef<T | null>()
    const [size, setSize] = useState<Size>({
        width: null,
        height: null,
    })
    const observer = useMemo(
        () =>
            new ResizeObserver(() => {
                if (ref.current) {
                    const size = {
                        width: ref.current.offsetWidth,
                        height: ref.current.offsetHeight,
                    }
                    setSize((oldSize) =>
                        size.width === oldSize.width &&
                        size.height === oldSize.height
                            ? oldSize
                            : size
                    )
                }
            }),
        []
    )
    const setRef = useCallback((elem: T | null) => {
        if (ref.current === elem) {
            return
        }
        if (ref.current) observer.unobserve(ref.current)
        ref.current = elem
        if (ref.current) observer.observe(ref.current)
    }, [])

    return [setRef, size]
}

export default useElementSize
