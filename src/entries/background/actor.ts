import { IDisposable } from "../shared/disposable"

type Action = () => Promise<void>

export class Actor extends EventTarget implements IDisposable {
    _inbox: Action[]
    _disposed: boolean

    constructor() {
        super()
        this._inbox = []
        this._disposed = false
    }
    dispose(): void {
        if (!this._disposed) {
            this._disposed = true
            this._inbox = []
            this.dispatchEvent(new CustomEvent("disposed"))
        }
    }
    _post<R>(action: () => Promise<R>): Promise<R> {
        if (this._disposed) {
            return Promise.reject(new Error("Disposed"))
        }
        return new Promise((resolve, reject) => {
            this._inbox.push(async () => {
                try {
                    resolve(action())
                } catch (err) {
                    reject(err)
                }
            })
            if (this._inbox.length == 1) {
                setTimeout(() => this.#drain(), 0)
            }
        })
    }
    async #drain() {
        this.dispatchEvent(new CustomEvent("busychanged"))
        let action;
        while (action = this._inbox.shift()) {
            await action()
            this.dispatchEvent(new CustomEvent("update"))
        }
        this.dispatchEvent(new CustomEvent("busychanged"))
    }
    get busy() {
        return this._inbox.length > 0
    }
}