import { useCallback, useMemo, useRef, useState } from "react"

type Size = {
    width: number | null
    height: number | null
}

function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
    (node: T | null) => void,
    Size,
    Size
] {
    const ref = useRef<T | null>()
    const [size, setSize] = useState<Size>({
        width: null,
        height: null,
    })
    const [clientSize, setClientSize] = useState<Size>({
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
                    const clientSize = {
                        width: ref.current.clientWidth,
                        height: ref.current.clientHeight,
                    }
                    setClientSize((oldSize) =>
                        clientSize.width === oldSize.width &&
                        clientSize.height === oldSize.height
                            ? oldSize
                            : clientSize
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

    return [setRef, size, clientSize]
}

export default useElementSize
