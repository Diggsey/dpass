type Patch<T> = {
    [Property in keyof T]?: Delta<T[Property]> | false
}

type ArrayElement<ArrayType> =
    ArrayType extends readonly (infer ElementType)[] ? ElementType : never;

export type Delta<T> = {
    replace: T,
} | {
    patch: Patch<T>
} | Delta<ArrayElement<T>>[] | null

export function computeDelta<T>(a: T, b: T): Delta<T> {
    if (a === b) {
        return null
    }
    if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
        if (Array.isArray(a) && Array.isArray(b)) {
            return computeArrayDelta(a, b)
        } else if (Object.getPrototypeOf(a) === Object.prototype && Object.getPrototypeOf(b) === Object.prototype) {
            return computeObjectDelta(a, b)
        }
    }
    return { replace: b }
}

function runtimeKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[]
}

function computeObjectDelta<T extends object>(a: T, b: T): Delta<T> {
    const allKeys = new Set(runtimeKeys<T>(a).concat(runtimeKeys<T>(b)))
    const patch: Patch<T> = {}
    let hasChanges = false
    for (const k of allKeys) {
        if (Object.hasOwn(b, k)) {
            const delta = computeDelta(a[k], b[k])
            if (delta !== null) {
                patch[k] = delta
                hasChanges = true
            }
        } else {
            patch[k] = false
            hasChanges = true
        }
    }
    if (hasChanges) {
        return { patch }
    } else {
        return null
    }
}

function computeArrayDelta<T extends ArrayElement<T>[]>(a: T, b: T): Delta<T> {
    if (a.length === b.length) {
        return a.map((av, i) => computeDelta(av, b[i]))
    }
    return { replace: b }
}

export function applyDelta<T>(a: T, delta: Delta<T>): T {
    if (delta === null) {
        return a
    } else if (Array.isArray(delta)) {
        if (!Array.isArray(a) || a.length !== delta.length) {
            throw new Error("Invalid delta application")
        }
        return a.map((av, i) => applyDelta<ArrayElement<T>>(av, delta[i])) as T
    } else if ("replace" in delta) {
        return delta.replace
    } else {
        const result: T = { ...a }
        for (const k of runtimeKeys<Patch<T>>(delta.patch)) {
            const p = delta.patch[k]
            if (p === false) {
                delete result[k]
            } else if (p) {
                result[k] = applyDelta(result[k], p)
            }
        }
        return result
    }
}
