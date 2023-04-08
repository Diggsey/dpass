import { ReactNode, useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ModalDialog } from "../../components/modalDialog"

type ModalArgs<T> = {
    close: () => void
    data: T
    setData: (data: T) => void
    initialFocusRef: (elem: HTMLElement | null) => void
}

type ModalState<T> =
    | {
          open: false
      }
    | {
          open: true
          data: T
      }

function useModalDialog<T = unknown>(
    render: (args: ModalArgs<T>) => ReactNode
): [ReactNode, (data: T) => void] {
    const initialFocus = useRef<HTMLElement | null>(null)
    const [state, setState] = useState<ModalState<T>>({
        open: false,
    })
    const close = useCallback(() => setState({ open: false }), [])
    const setData = useCallback((data: T) => setState({ open: true, data }), [])
    const initialFocusRef = useCallback((elem: HTMLElement | null) => {
        initialFocus.current = elem
    }, [])
    const portal = createPortal(
        <ModalDialog
            open={state.open}
            close={close}
            initialFocus={initialFocus}
        >
            {state.open
                ? render({ close, data: state.data, setData, initialFocusRef })
                : null}
        </ModalDialog>,
        document.body
    )
    return [portal, setData]
}

export default useModalDialog
