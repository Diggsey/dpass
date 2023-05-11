import { Disposable, IDisposable } from "../shared/mixins/disposable"

export type RcInner<T> = {
    count: number
    value: T
}

interface IRcConstructor<T extends IDisposable, U extends Rc<T>> {
    new (inner: RcInner<T>): U
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RcValueType<T extends IRcConstructor<any, any>> = T extends IRcConstructor<
    infer R,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
>
    ? R
    : never
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RcInstanceType<T extends IRcConstructor<any, any>> =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    T extends IRcConstructor<any, infer R> ? R : never

export class Rc<T extends IDisposable> extends Disposable(EventTarget) {
    #innerOpt: RcInner<T> | null

    constructor(inner: RcInner<T>) {
        super()
        inner.count += 1
        this.#innerOpt = inner
    }
    get #inner(): RcInner<T> {
        if (!this.#innerOpt) {
            throw new Error("Disposed")
        }
        return this.#innerOpt
    }
    get value(): T {
        return this.#inner.value
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static create<T extends IRcConstructor<any, any>>(
        cls: T,
        value: RcValueType<T>
    ): RcInstanceType<T> {
        return new cls({ count: 0, value })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static copy<T extends IRcConstructor<any, any>>(
        cls: T,
        rc: RcInstanceType<T>
    ): RcInstanceType<T> {
        return new cls(rc.#inner)
    }
    downgrade(): WeakRc<T> {
        return new WeakRc(this.#inner)
    }
    dispose(): void {
        if (this.#innerOpt) {
            this.#innerOpt.count -= 1
            if (this.#innerOpt.count == 0) {
                this.#innerOpt.value.dispose()
            }
            this.#innerOpt = null
        }
        super.dispose()
    }
}

export class WeakRc<T extends IDisposable> {
    #innerOpt: RcInner<T> | null
    constructor(inner: RcInner<T> | null) {
        this.#innerOpt = inner
    }
    get #inner(): RcInner<T> {
        if (!this.#innerOpt) {
            throw new Error("Disposed")
        }
        return this.#innerOpt
    }
    get count(): number {
        return this.#innerOpt ? this.#innerOpt.count : 0
    }
    upgrade<U extends Rc<T>>(cls: new (inner: RcInner<T>) => U): U | null {
        if (this.count > 0) {
            return new cls(this.#inner)
        } else {
            return null
        }
    }
}
