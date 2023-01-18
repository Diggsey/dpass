import { mixin } from "../mixin"

const ENABLE_TRACING = true

export interface ITraceable {
    trace(strings: TemplateStringsArray, ...args: unknown[]): void
}

export const Traceable = mixin<ITraceable>(Base => (class Traceable extends Base implements ITraceable {
    trace(strings: TemplateStringsArray, ...args: unknown[]) {
        if (ENABLE_TRACING) {
            const msg = String.raw({ raw: strings }, ...args)
            console.info(`${this.toString()}: ${msg}`)
        }
    }
}))
