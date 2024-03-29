import React, {
    ComponentPropsWithoutRef,
    ForwardedRef,
    forwardRef,
    ForwardRefExoticComponent,
    PropsWithoutRef,
    RefAttributes,
} from "react"
import { BaseRefType, ClassName, cn, ElementTypeWithProps } from "../ui"

type StyleableElementType = ElementTypeWithProps<{ className: string }>

type StyledElemProps<T extends StyleableElementType> = Omit<
    ComponentPropsWithoutRef<T>,
    "className"
> & { className?: ClassName }

export function styledElem<
    T extends StyleableElementType,
    Attributes = unknown
>(
    type: T,
    baseClassName?: ClassName,
    nested?: Attributes
): ForwardRefExoticComponent<
    PropsWithoutRef<StyledElemProps<T>> & RefAttributes<BaseRefType<T>>
> &
    Attributes {
    const f = forwardRef(
        (
            { className, ...props }: StyledElemProps<T>,
            ref: ForwardedRef<BaseRefType<T>>
        ) =>
            React.createElement(type, {
                className: cn(baseClassName, className),
                ref,
                ...props,
            })
    )
    return Object.assign(f, nested)
}

export const Card = styledElem(
    "div",
    "divide-y divide-gray-200 overflow-hidden sm:rounded-lg bg-white shadow grid",
    {
        Header: styledElem("div", "px-4 py-5 sm:px-6"),
        Body: styledElem("div", "px-4 py-5 sm:p-6"),
        Footer: styledElem("div", "px-4 py-5 sm:px-6"),
    }
)

export const BaseButton = styledElem(
    "button",
    "relative inline-flex items-center justify-center gap-x-1.5 text-sm font-semibold"
)

export const PrimaryButton = styledElem(
    BaseButton,
    "rounded-md px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 shadow-sm"
)

export const SecondaryButton = styledElem(
    BaseButton,
    "rounded-md text-gray-900 disabled:text-gray-600"
)

export const OutlineButton = styledElem(
    BaseButton,
    "rounded-md px-3 py-2 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:ring-gray-100 shadow-sm"
)

export const TextButton = styledElem(
    BaseButton,
    "rounded-md px-0.5 font-medium text-indigo-600 hover:text-indigo-500 disabled:text-gray-600 focus-visible:outline focus-visible:outline-indigo-500 focus-visible:outline-offset-2"
)

export const FlatButton = styledElem(
    BaseButton,
    "justify-center py-4 text-gray-900 -outline-offset-2 bg-white hover:bg-gray-50 disabled:bg-white disabled:text-gray-600"
)

export const DangerButton = styledElem(
    BaseButton,
    "rounded-md px-3 py-2 bg-red-600 text-white hover:bg-red-500 disabled:bg-red-300 shadow-sm"
)

export const Input = styledElem(
    "input",
    "block w-full rounded-md border-0 py-1.5 text-gray-900 aria-invalid:text-red-900 shadow-sm ring-1 ring-inset ring-gray-300 aria-invalid:ring-red-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 aria-invalid:focus:ring-red-500 sm:text-sm sm:leading-6"
)

export const ValidationError = styledElem("p", "mt-2 text-sm text-red-600")

export const HelpText = styledElem("p", "mt-2 text-sm text-gray-500")

export const Label = styledElem(
    "label",
    "block text-sm font-medium leading-6 text-gray-900"
)

export const Select = styledElem(
    "select",
    "block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
)

export const TextArea = styledElem(
    "textarea",
    "block w-full rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:py-1.5 sm:text-sm sm:leading-6"
)

export const Checkbox = {
    Label: styledElem(
        "label",
        "relative flex items-center leading-6 cursor-pointer text-sm font-medium text-gray-900 gap-3 aria-disabled:cursor-default aria-disabled:text-gray-500"
    ),
    Input: styledElem(
        "input",
        "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 disabled:text-gray-500"
    ),
}
