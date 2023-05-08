import {
    ComponentPropsWithoutRef,
    SyntheticEvent,
    forwardRef,
    useCallback,
    useRef,
} from "react"
import { Input } from "./styledElem"
import { useEventCallback, useEventListener } from "../ui/hooks"

type FormInputProps = ComponentPropsWithoutRef<"input"> & {
    onCommit?: (e: SyntheticEvent<HTMLInputElement>) => void
}
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
    ({ onCommit, ...props }: FormInputProps, ref) => {
        const elemRef = useRef<HTMLInputElement | null>(null)

        const ref2 = useCallback((elem: HTMLInputElement) => {
            elemRef.current = elem
            if (typeof ref === "function") {
                ref(elem)
            } else if (ref) {
                ref.current = elem
            }
        }, [])

        const commit = useEventCallback((e) => {
            if (onCommit) {
                return onCommit(e as SyntheticEvent<HTMLInputElement>)
            }
        })

        useEventListener("change", commit, elemRef)

        return <Input ref={ref2} {...props} />
    }
)
