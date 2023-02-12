import { FunctionalComponent, JSX } from "preact"
import { useRef, useState } from "preact/hooks"
import { ClassName, cn } from "../ui"

type PasswordInputProps = {
    name?: string,
    value?: string,
    onInput?: JSX.GenericEventHandler<HTMLInputElement>,
    placeholder?: string,
    class?: ClassName,
    inputClass?: ClassName,
    autofocus?: boolean,
}

export const PasswordInput: FunctionalComponent<PasswordInputProps> = ({ name, value, onInput, placeholder, class: className, inputClass, autofocus }) => {
    const [passwordVisible, setPasswordVisible] = useState(false)
    const input = useRef<HTMLInputElement | null>(null);
    const eye = useRef<HTMLSpanElement | null>(null);
    return <div class={cn("control has-icons-right", className)}>
        <input
            ref={input}
            name={name}
            class={cn("input is-family-monospace", inputClass)}
            type={passwordVisible ? "text" : "password"}
            placeholder={placeholder}
            value={value}
            onInput={onInput}
            autofocus={autofocus}
            onBlur={e => {
                if (e.relatedTarget === eye.current) {
                    e.preventDefault()
                } else {
                    setPasswordVisible(false)
                }
            }}
            size={40}
        />
        <span ref={eye} class="icon is-right is-clickable" tabIndex={0} onClick={() => {
            setPasswordVisible(!passwordVisible)
            setTimeout(() => {
                input.current?.focus()
            }, 0)
        }}>
            <i class={cn("fas", passwordVisible ? "fa-eye" : "fa-eye-slash")}></i>
        </span>
    </div >
}