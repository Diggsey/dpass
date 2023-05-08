import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"
import {
    FC,
    ChangeEventHandler,
    useRef,
    useState,
    FocusEventHandler,
    useCallback,
    EventHandler,
    SyntheticEvent,
} from "react"
import { ClassName, cn } from "../ui"
import { FormInput } from "./formInput"

type PasswordInputProps = {
    name?: string
    value?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    onBlur?: FocusEventHandler<HTMLInputElement>
    onCommit?: EventHandler<SyntheticEvent<HTMLInputElement>>
    placeholder?: string
    className?: ClassName
    inputClass?: ClassName
    inputId?: string
    autoFocus?: boolean
    "aria-invalid"?: boolean
    readOnly?: boolean
}

export const PasswordInput: FC<PasswordInputProps> = ({
    name,
    value,
    onChange,
    onBlur,
    onCommit,
    placeholder,
    className,
    inputId,
    inputClass,
    autoFocus,
    "aria-invalid": areaInvalid,
    readOnly,
}) => {
    const [passwordVisible, setPasswordVisible] = useState(false)
    const input = useRef<HTMLInputElement | null>(null)
    const togglePasswordVisible = useCallback(() => {
        setPasswordVisible((v) => !v)
        if (input.current) {
            input.current.focus()
            // When the input type changes it makes the blinking cursor
            // disappear. Re-setting the selection range seems to fix it.
            const { selectionStart, selectionEnd, selectionDirection } =
                input.current
            input.current.setSelectionRange(
                0,
                0,
                selectionDirection === "backward" ? "forward" : "backward"
            )
            input.current.setSelectionRange(
                selectionStart,
                selectionEnd,
                selectionDirection ?? "none"
            )
        }
    }, [])
    const blur = useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
            setPasswordVisible(false)
            onBlur && onBlur(e)
        },
        [onBlur]
    )
    return (
        <div className={cn("relative mt-2 rounded-md shadow-sm", className)}>
            <FormInput
                id={inputId}
                ref={input}
                name={name}
                className={cn("font-mono", inputClass)}
                type={passwordVisible ? "text" : "password"}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
                onBlur={blur}
                onCommit={onCommit}
                aria-invalid={areaInvalid}
                readOnly={readOnly}
            />
            <div
                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-indigo-900 hover:text-indigo-600 aria-invalid:text-red-800 aria-invalid:hover:text-red-500"
                onMouseDown={(e) => {
                    e.preventDefault()
                    togglePasswordVisible()
                }}
                aria-invalid={areaInvalid}
            >
                {passwordVisible ? (
                    <EyeIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                    <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                )}
            </div>
        </div>
    )
}
