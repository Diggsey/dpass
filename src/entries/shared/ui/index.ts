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
