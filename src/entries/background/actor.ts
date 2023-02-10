import { Disposable } from "../shared/mixins/disposable"
import { ObjectId } from "../shared/mixins/objectId"
import { Traceable } from "../shared/mixins/traceable"

type Action = () => Promise<void>

export class Actor extends Traceable(ObjectId(Disposable(EventTarget))) {
    #inbox: Action[] = []
    #busy = false

    dispose(): void {
        if (!this.disposed) {
            this.#inbox = []
        }
        super.dispose()
    }
    _post<R>(name: string, action: () => Promise<R>): Promise<R> {
        if (this.disposed) {
            return Promise.reject(new Error("Disposed"))
        }
        return new Promise((resolve, reject) => {
            this.#inbox.push(async () => {
                this.trace`enter ${name}`
                try {
                    const res = await action()
                    this.trace`leave ${name}`
                    resolve(res)
                } catch (err) {
                    this.trace`abort ${name} - ${err}`
                    reject(err)
                }
            })
            if (!this.#busy) {
                this.#busy = true
                this.trace`busy`
                this.dispatchEvent(new CustomEvent("busychanged"))
                setTimeout(() => this.#drain(), 0)
            }
        })
    }
    async #drain() {
        try {
            let action;
            while ((action = this.#inbox.shift())) {
                await action()
                this.dispatchEvent(new CustomEvent("update"))
            }
        } finally {
            this.#busy = false
            this.trace`idle`
            this.dispatchEvent(new CustomEvent("busychanged"))
        }
    }
    get busy() {
        return this.#busy
    }
}