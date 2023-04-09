export type GenericFunction = (...x: never[]) => unknown
export type GenericConstructor = new (...args: never[]) => unknown

export type Assume<T, U> = T extends U ? T : U

export interface HKT {
    readonly _1?: unknown
    new: GenericFunction
}

export type Apply<F extends HKT, _1> = ReturnType<
    (F & {
        readonly _1: _1
    })["new"]
>

export interface Always<T> {
    new: () => T
}
