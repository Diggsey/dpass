import {
    ComponentPropsWithoutRef,
    forwardRef,
    useCallback,
    useLayoutEffect,
    useRef,
    ChangeEvent,
} from "react"
import { TextArea } from "./styledElem"

function autosize(elem: HTMLTextAreaElement) {
    elem.style.height = "0"
    elem.style.height = `${elem.scrollHeight}px`
}

export const AutoTextArea = forwardRef<
    HTMLTextAreaElement,
    ComponentPropsWithoutRef<"textarea">
>(
    (
        { value, onChange, ...props }: ComponentPropsWithoutRef<"textarea">,
        ref
    ) => {
        const ref2 = useRef<HTMLTextAreaElement>()
        const combinedRef = useCallback(
            (elem: HTMLTextAreaElement) => {
                ref2.current = elem
                if (ref) {
                    if (typeof ref === "function") {
                        ref(elem)
                    } else {
                        ref.current = elem
                    }
                }
            },
            [ref]
        )
        const change = useCallback(
            (e: ChangeEvent<HTMLTextAreaElement>) => {
                autosize(e.currentTarget)
                onChange && onChange(e)
            },
            [onChange]
        )
        useLayoutEffect(() => {
            if (ref2.current) {
                autosize(ref2.current)
            }
        }, [value])

        return (
            <TextArea
                ref={combinedRef}
                value={value}
                onChange={change}
                {...props}
            />
        )
    }
)
