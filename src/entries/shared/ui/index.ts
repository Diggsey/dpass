import { ComponentPropsWithRef, JSXElementConstructor } from "react"

export type ClassName =
    | { [className: string]: boolean | null | undefined }
    | ClassName[]
    | string
    | null
    | undefined
    | false

function mapArg(arg: ClassName): string {
    if (!arg) {
        return ""
    }
    if (typeof arg === "string") {
        return arg
    }
    if (Array.isArray(arg)) {
        return cn(...arg)
    }
    return Object.entries(arg)
        .filter(([_, v]) => v)
        .map(([k, _]) => k.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase())
        .join(" ")
}

export function cn(...args: ClassName[]): string {
    return args.map(mapArg).filter(Boolean).join(" ")
}

type IntrinsicElementWithProps<P> = keyof {
    [K in keyof JSX.IntrinsicElements as P extends JSX.IntrinsicElements[K]
        ? K
        : never]: JSX.IntrinsicElements[K]
}

export type ElementTypeWithProps<P> =
    | JSXElementConstructor<P>
    | IntrinsicElementWithProps<P>

type RefType<P> = "ref" extends keyof P ? P["ref"] : never
type RefElementType<R> = R extends React.RefCallback<infer E>
    ? E
    : R extends React.RefObject<infer E>
    ? E
    : never

export type BaseRefType<T extends React.ElementType> = RefElementType<
    RefType<ComponentPropsWithRef<T>>
>
