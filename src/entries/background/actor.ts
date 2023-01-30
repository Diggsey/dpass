import { Disposable } from "../shared/mixins/disposable"
import { ObjectId } from "../shared/mixins/objectId"
import { Traceable } from "../shared/mixins/traceable"

type Action = () => Promise<void>

export class Actor extends Traceable(ObjectId(Disposable(EventTarget))) {
    _inbox: Action[] = []

    dispose(): void {
        if (!this.disposed) {
            this._inbox = []
        }
        super.dispose()
    }
    _post<R>(name: string, action: () => Promise<R>): Promise<R> {
        if (this.disposed) {
            return Promise.reject(new Error("Disposed"))
        }
        return new Promise((resolve, reject) => {
            this._inbox.push(async () => {
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
            if (this._inbox.length == 1) {
                setTimeout(() => this.#drain(), 0)
            }
        })
    }
    async #drain() {
        this.trace`busy`
        this.dispatchEvent(new CustomEvent("busychanged"))
        let action;
        while ((action = this._inbox.shift())) {
            await action()
            this.dispatchEvent(new CustomEvent("update"))
        }
        this.trace`idle`
        this.dispatchEvent(new CustomEvent("busychanged"))
    }
    get busy() {
        return this._inbox.length > 0
    }
}