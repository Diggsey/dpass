import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"
import { FC, ChangeEventHandler, useRef, useState } from "react"
import { ClassName, cn } from "../ui"

type PasswordInputProps = {
    name?: string
    value?: string
    onChange?: ChangeEventHandler<HTMLInputElement>
    placeholder?: string
    className?: ClassName
    inputClass?: ClassName
    inputId?: string
    autoFocus?: boolean
}

export const PasswordInput: FC<PasswordInputProps> = ({
    name,
    value,
    onChange,
    placeholder,
    className,
    inputId,
    inputClass,
    autoFocus,
}) => {
    const [passwordVisible, setPasswordVisible] = useState(false)
    const input = useRef<HTMLInputElement | null>(null)
    const eye = useRef<HTMLDivElement | null>(null)
    return (
        <div className={cn("relative rounded-md shadow-sm", className)}>
            <input
                id={inputId}
                ref={input}
                name={name}
                className={cn(
                    "font-mono block w-full rounded-md border-0 py-1.5 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6",
                    inputClass
                )}
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
            />
            <div
                ref={eye}
                className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer text-indigo-600 hover:text-indigo-900"
                tabIndex={0}
                onClick={() => {
                    setPasswordVisible(!passwordVisible)
                    setTimeout(() => {
                        input.current?.focus()
                    }, 0)
                }}
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
