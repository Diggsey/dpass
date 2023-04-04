import {
    ComponentPropsWithoutRef,
    forwardRef,
    FocusEvent,
    KeyboardEvent,
    useCallback,
    SyntheticEvent,
    useRef,
    ChangeEvent,
} from "react"
import { Input } from "./styledElem"

type FormInputProps = ComponentPropsWithoutRef<"input"> & {
    onCommit?: (e: SyntheticEvent<HTMLInputElement>) => void
}
export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
    (
        { onCommit, onBlur, onChange, onKeyDown, ...props }: FormInputProps,
        ref
    ) => {
        const changed = useRef(false)
        const blur = useCallback(
            (e: FocusEvent<HTMLInputElement>) => {
                if (changed.current) {
                    changed.current = false
                    onCommit && onCommit(e)
                }
                onBlur && onBlur(e)
            },
            [onCommit, onBlur]
        )
        const keyDown = useCallback(
            (e: KeyboardEvent<HTMLInputElement>) => {
                if (changed.current && e.key === "Enter") {
                    changed.current = false
                    onCommit && onCommit(e)
                }
                onKeyDown && onKeyDown(e)
            },
            [onCommit, onKeyDown]
        )
        const change = useCallback(
            (e: ChangeEvent<HTMLInputElement>) => {
                changed.current = true
                onChange && onChange(e)
            },
            [onChange]
        )
        return (
            <Input
                ref={ref}
                onChange={change}
                onBlur={blur}
                onKeyDown={keyDown}
                {...props}
            />
        )
    }
)
