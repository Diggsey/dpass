import browser, { Runtime } from "webextension-polyfill"
import { applyDelta, computeDelta, Delta } from "./delta"
import { Disposable } from "./mixins/disposable"

export class Publisher<T> extends EventTarget {
    #port: Runtime.Port
    #lastValue: T | null

    constructor(port: Runtime.Port) {
        super()
        this.#port = port
        this.#lastValue = null
        this.#port.onDisconnect.addListener(() =>
            this.dispatchEvent(new CustomEvent("disconnect"))
        )
    }

    publish(newValue: T) {
        const delta = computeDelta(this.#lastValue, newValue)
        this.#lastValue = newValue

        if (delta !== null) {
            this.#port.postMessage(delta)
        }
    }
}

export class Subscriber<T> extends Disposable(EventTarget) {
    #channelName: string
    #port: Runtime.Port | null
    #lastValue: T | null
    #reconnectionAttempts = 0

    constructor(channelName: string) {
        super()
        this.#port = null
        this.#lastValue = null
        this.#channelName = channelName
        this.reconnect()
    }
    dispose(): void {
        super.dispose()
        this.reconnect()
    }

    reconnect() {
        if (this.#port !== null) {
            this.#port.onMessage.removeListener(this.#onMessage)
            this.#port.onDisconnect.removeListener(this.#onDisconnect)
            this.#port.disconnect()
            this.#port = null
        }
        this.#lastValue = null
        if (!this.disposed) {
            this.#port = browser.runtime.connect({ name: this.#channelName })
            this.#port.onMessage.addListener(this.#onMessage)
            this.#port.onDisconnect.addListener(this.#onDisconnect)
            this.#reconnectionAttempts += 1
        }
    }

    #onMessage = (msg: Delta<T>) => {
        this.#reconnectionAttempts = 0
        this.#lastValue = applyDelta(this.#lastValue, msg)
        if (this.#lastValue !== null) {
            this.update(this.#lastValue)
        }
    }
    #onDisconnect = () => {
        setTimeout(() => this.reconnect(), 100 << this.#reconnectionAttempts)
    }

    get currentValue(): T | null {
        return this.#lastValue
    }

    update(newValue: T) {
        this.dispatchEvent(new CustomEvent("update", { detail: newValue }))
    }
}
