import { IDisposable } from "../shared/disposable"

export type RcInner<T> = {
    count: number,
    value: T,
}

interface IRcConstructor<T extends IDisposable, U extends Rc<T>> {
    new(inner: RcInner<T>): U
}
type RcValueType<T extends IRcConstructor<any, any>> = T extends IRcConstructor<infer R, any> ? R : never;
type RcInstanceType<T extends IRcConstructor<any, any>> = T extends IRcConstructor<any, infer R> ? R : never;

export class Rc<T extends IDisposable> implements IDisposable {
    #inner_opt: RcInner<T> | null

    constructor(inner: RcInner<T>) {
        inner.count += 1
        this.#inner_opt = inner
    }
    get #inner(): RcInner<T> {
        if (!this.#inner_opt) {
            throw new Error("Disposed")
        }
        return this.#inner_opt
    }
    get value(): T {
        return this.#inner.value
    }
    static create<T extends IRcConstructor<any, any>>(cls: T, value: RcValueType<T>): RcInstanceType<T> {
        return new cls({ count: 0, value })
    }
    static copy<T extends IRcConstructor<any, any>>(cls: T, rc: RcInstanceType<T>): RcInstanceType<T> {
        return new cls(rc.#inner)
    }
    downgrade(): WeakRc<T> {
        return new WeakRc(this.#inner)
    }
    dispose(): void {
        if (this.#inner_opt) {
            this.#inner_opt.count -= 1
            if (this.#inner_opt.count == 0) {
                this.#inner_opt.value.dispose()
            }
            this.#inner_opt = null
        }
    }
}

export class WeakRc<T extends IDisposable> {
    #inner_opt: RcInner<T> | null
    constructor(inner: RcInner<T> | null) {
        this.#inner_opt = inner
    }
    get #inner(): RcInner<T> {
        if (!this.#inner_opt) {
            throw new Error("Disposed")
        }
        return this.#inner_opt
    }
    get count(): number {
        return this.#inner_opt ? this.#inner_opt.count : 0
    }
    upgrade<U extends Rc<T>>(cls: new (inner: RcInner<T>) => U): U | null {
        if (this.count > 0) {
            return new cls(this.#inner)
        } else {
            return null
        }
    }
}
