import {
    Apply,
    HKT,
    Always,
    Assume,
    GenericFunction,
    GenericConstructor,
} from "./hkt"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MixinConstructorArgs = any[]

interface Mixin<I, B, P extends HKT> {
    <TBase extends new (...args: MixinConstructorArgs) => B>(
        Base: TBase & Apply<P, TBase>
    ): TBase & (new (...args: MixinConstructorArgs) => I) & Apply<P, TBase>
}

export function mixin<I, B = object, P extends HKT = Always<unknown>>(
    f: Mixin<I, B, P>
): Mixin<I, B, P> {
    const classMap = new Map()
    return (base) => {
        if (!classMap.has(base)) {
            classMap.set(base, f(base))
        }
        return classMap.get(base)
    }
}

export type Initializer<T> = (this: T) => void

export type MixinDecorator<T> = (
    derived: { new (...args: MixinConstructorArgs): T },
    addInitializer: (init: Initializer<T>) => void
) => void

// There is some Typescript weirdness that requires the list to
// be defined in this way in order to correctly pick up heterogenous
// element types.
type ConstList<T> =
    | readonly [T | null]
    | readonly [T, T]
    | readonly [T, T, T]
    | readonly [T, T, T, T]
    | readonly [T, T, T, T, T]
    | readonly [T, T, T, T, T, T]
    | readonly [T, T, T, T, T, T, T]
    | readonly [T, T, T, T, T, T, T, T]
    | readonly [T, T, T, T, T, T, T, T, T]
    | readonly [T, T, T, T, T, T, T, T, T, T]

export interface IDecorated<T> {
    readonly _decorators: ConstList<MixinDecorator<T>>
}
export interface IDecoratedHkt extends HKT {
    new: (
        x: Assume<this["_1"], GenericConstructor>
    ) => IDecorated<InstanceType<typeof x>>
}

// Handles loading and updating the setup key
export const Decorated = mixin<unknown, object, IDecoratedHkt>((Base) => {
    const initializers: Initializer<Decorated>[] = []
    class Decorated extends Base {
        constructor(...args: MixinConstructorArgs) {
            super(...args)
            for (const initializer of initializers) {
                initializer.call(this)
            }
        }
    }

    const addInitializer = (initializer: Initializer<Decorated>) => {
        initializers.push(initializer)
    }

    for (const decorator of Decorated._decorators as Iterable<
        MixinDecorator<Decorated>
    >) {
        decorator(Decorated, addInitializer)
    }

    return Decorated
})

export function abstractMethod<Name extends string>(
    name: Name
): <
    T extends { readonly [name in Name]: GenericFunction & { abstract?: true } }
>(
    derived: new (...args: MixinConstructorArgs) => T,
    addInitializer: (init: Initializer<T>) => void
) => void {
    function decorator<
        T extends {
            readonly [name in Name]: GenericFunction & { abstract?: true }
        }
    >(
        derived: {
            new (...args: MixinConstructorArgs): T
            readonly prototype: {
                [name in Name]: GenericFunction & { abstract?: true }
            }
        },
        addInitializer: (init: Initializer<T>) => void
    ): void {
        derived.prototype[name].abstract = true
        addInitializer(function (this: T) {
            if (this[name].abstract) {
                throw new Error(
                    `Derived class must implement '${name.toString()}(...)'`
                )
            }
        })
    }
    return decorator
}
