export function expect<T>(arg: T | undefined, err?: string): T {
    if (arg === undefined) {
        throw new Error(err)
    }
    return arg
}

interface ObjectWithId extends Object {
    id: string
}

export function objectKey({ id, ...params }: ObjectWithId): string {
    const paramsArray = Object.entries(params)
    paramsArray.sort((a, b) => a[0].localeCompare(b[0]))
    const paramStr = paramsArray.map(([k, v]) => `${k}=${v}`).join(",")
    return `${id}:${paramStr}`
}

export function mapObjectValues<T, U>(obj: { [key: string]: T }, f: (v: T) => U): { [key: string]: U } {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))
}

export function filterObjectValues<T>(obj: { [key: string]: T }, f: (v: T) => boolean): { [key: string]: T } {
    return Object.fromEntries(Object.entries(obj).filter(([_k, v]) => f(v)))
}

export function doesLoginUrlMatch(urlStr: string | URL, loginUrlStr: string | URL): boolean {
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