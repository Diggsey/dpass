import { mixin } from "../mixin"

export interface IDisposable {
    get disposed(): boolean
    dispose(): void
}

export const Disposable = mixin<IDisposable, EventTarget>(
    (Base) =>
        class Disposable extends Base implements IDisposable {
            #disposed = false

            get disposed() {
                return this.#disposed
            }
            dispose(): void {
                if (!this.#disposed) {
                    this.#disposed = true
                    this.dispatchEvent(new CustomEvent("disposed"))
                }
            }
        }
)
