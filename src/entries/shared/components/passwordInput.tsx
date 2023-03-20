import { FC, ChangeEventHandler, useRef, useState } from "react"
import { ClassName, cn } from "../ui"

type PasswordInputProps = {
    name?: string
    value?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    className?: ClassName
    inputClass?: ClassName
    autoFocus?: boolean
}

export const PasswordInput: FC<PasswordInputProps> = ({
    name,
    value,
    onChange,
    placeholder,
    className,
    inputClass,
    autoFocus,
}) => {
    const [passwordVisible, setPasswordVisible] = useState(false)
    const input = useRef<HTMLInputElement | null>(null)
    const eye = useRef<HTMLSpanElement | null>(null)
    return (
        <div className={cn("control has-icons-right", className)}>
            <input
                ref={input}
                name={name}
                className={cn("input is-family-monospace", inputClass)}
                type={passwordVisible ? "text" : "password"}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                autoFocus={autoFocus}
                onBlur={(e) => {
                    if (e.relatedTarget === eye.current) {
                        e.preventDefault()
                    } else {
                        setPasswordVisible(false)
                    }
                }}
                size={40}
            />
            <span
                ref={eye}
                className="icon is-right is-clickable"
                tabIndex={0}
                onClick={() => {
                    setPasswordVisible(!passwordVisible)
                    setTimeout(() => {
                        input.current?.focus()
                    }, 0)
                }}
            >
                <i
                    className={cn(
                        "fas",
                        passwordVisible ? "fa-eye" : "fa-eye-slash"
                    )}
                ></i>
            </span>
        </div>
    )
}
