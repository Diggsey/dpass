export function expect<T>(arg: T | undefined, err?: string): T {
    if (arg === undefined) {
        throw new Error(err)
    }
    return arg
}

interface ObjectWithId {
    id: string
    [key: string]: string | number | null | boolean
}

const escapeRegex = /([,\\])/g
function escapeValue(v: string | number | boolean | null): string {
    return `${v}`.replaceAll(escapeRegex, "\\$1")
}

export function objectKey({ id, ...params }: ObjectWithId): string {
    const paramsArray = Object.entries(params)
    paramsArray.sort((a, b) => a[0].localeCompare(b[0]))
    const paramStr = paramsArray
        .map(([k, v]) => `${k}=${escapeValue(v)}`)
        .join(",")
    return `${id}:${paramStr}`
}

export function mapObjectValues<T, U>(
    obj: { [key: string]: T },
    f: (v: T) => U
): { [key: string]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}

export function filterObjectValues<T>(
    obj: { [key: string]: T },
    f: (v: T) => boolean
): { [key: string]: T } {
    return Object.fromEntries(Object.entries(obj).filter(([_k, v]) => f(v)))
}

export function doesLoginUrlMatch(
    urlStr: string | URL,
    loginUrlStr: string | URL
): boolean {
    const loginUrl = new URL(loginUrlStr)
    const url = new URL(urlStr)
    if (loginUrl.search === "") {
        url.search = ""
    }
    if (loginUrl.hash === "") {
        url.hash = ""
    }
    return url.href === loginUrl.href
}

export type Json =
    | null
    | boolean
    | number
    | string
    | ReadonlyArray<Json>
    | { readonly [key: string]: Json }

export type TimerId = ReturnType<typeof setTimeout>

export function sanitizeNameForExport(name: string | null | undefined): string {
    return (name ?? "unnamed").toLowerCase().replaceAll(" ", "_").slice(0, 16)
}

type FilePickerOptions = {
    readonly accept?: string
    readonly multiple?: boolean
}

export function openFilePicker(
    options: FilePickerOptions,
    cb: (urls: string[]) => Promise<void>
) {
    const input = document.createElement("input")
    input.type = "file"
    if (options.accept !== undefined) {
        input.accept = options.accept
    }
    if (options.multiple !== undefined) {
        input.multiple = options.multiple
    }

    input.onchange = async () => {
        if (input.files) {
            const urls = []
            try {
                for (let i = 0; i < input.files.length; ++i) {
                    urls.push(URL.createObjectURL(input.files[i]))
                }

                await cb([...urls])
            } finally {
                for (const url of urls) {
                    URL.revokeObjectURL(url)
                }
            }
        }
    }
    input.click()
}

export type SmallInt = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type Tuple<T, N extends SmallInt> = _TupleOf<T, N, []>
type _TupleOf<T, N extends SmallInt, R extends T[]> = R["length"] extends N
    ? R
    : _TupleOf<T, N, [T, ...R]>

export function splitN<N extends Exclude<SmallInt, 0>>(
    count: N,
    haystack: string,
    needle: string
): Tuple<string, N> | null {
    if (count === 1) {
        return [haystack] as Tuple<string, N>
    } else {
        const idx = haystack.indexOf(needle)
        if (idx === -1) {
            return null
        } else {
            const head = haystack.slice(0, idx)
            const tail = splitN(
                (count - 1) as Exclude<SmallInt, 0>,
                haystack.slice(idx + needle.length),
                needle
            )
            if (tail === null) {
                return null
            }
            return [head, ...tail] as Tuple<string, N>
        }
    }
}
