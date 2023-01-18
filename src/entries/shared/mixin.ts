
interface Mixin<I, B> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <TBase extends (new (...args: any[]) => B)>(Base: TBase): TBase & (new (...args: any[]) => I)
}

export function mixin<I, B = object>(f: Mixin<I, B>): Mixin<I, B> {
    const classMap = new Map()
    return base => {
        if (!classMap.has(base)) {
            classMap.set(base, f(base))
        }
        return classMap.get(base)
    }
}
