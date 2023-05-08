import { TimerId } from "."

export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY

export function endOfDay(timestamp?: number): number {
    const d = timestamp === undefined ? new Date() : new Date(timestamp)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 1)
    return d.getTime()
}

export function ceilTime(timestamp?: number): number {
    return Math.ceil((timestamp ?? Date.now()) / 1000.0) * 1000.0
}

export function roundedTime(timestamp?: number): number {
    return Math.round((timestamp ?? Date.now()) / 1000.0) * 1000.0
}

type TimerWheelCallback = (ts: number) => void

class TimerWheel {
    #callbacks = new Map<TimerWheelCallback, number>()
    #minTimestamp = Infinity
    #timerId: TimerId | null = null

    get minTimestamp(): number {
        return this.#minTimestamp
    }
    set minTimestamp(value: number) {
        if (this.#timerId !== null) {
            clearTimeout(this.#timerId)
        }
        this.#minTimestamp = value
        if (value !== Infinity) {
            const delay = Math.max(value - Date.now(), 0)
            this.#timerId = setTimeout(this.#update, delay)
        }
    }

    #update = () => {
        this.#timerId = null
        const timestamp = roundedTime()
        const fs = []
        let newMinTimestamp = Infinity
        for (const [f, ts] of this.#callbacks) {
            if (ts <= timestamp) {
                fs.push(f)
                this.#callbacks.delete(f)
            } else {
                newMinTimestamp = Math.min(newMinTimestamp, ts)
            }
        }
        this.minTimestamp = newMinTimestamp
        for (const f of fs) {
            try {
                f(timestamp)
            } catch (ex) {
                console.error(ex)
            }
        }
    }

    add(timestamp: number, f: TimerWheelCallback): () => void {
        if (timestamp === Infinity) {
            return () => {}
        }
        timestamp = ceilTime(timestamp)
        this.#callbacks.set(f, timestamp)

        if (timestamp < this.minTimestamp) {
            this.minTimestamp = timestamp
        }

        return () => {
            this.#callbacks.delete(f)
        }
    }
}

export const TIMER_WHEEL = new TimerWheel()

export type TimeView<T> = (timestamp: number) => {
    current: T
    expires: number
}

const RELATIVE_INTERVALS: [number, string | null][] = [
    [4 * WEEK, null],
    [WEEK, "week"],
    [DAY, "day"],
    [HOUR, "hour"],
    [MINUTE, "minute"],
    [SECOND, "second"],
]

export function relativeDateView(timestamp: number): TimeView<string> {
    return (now) => {
        const date = new Date(timestamp)
        const delta = now - timestamp
        for (const [v, name] of RELATIVE_INTERVALS) {
            if (delta >= v) {
                if (name === null) {
                    return {
                        current: date.toLocaleDateString(),
                        expires: Infinity,
                    }
                } else {
                    const n = Math.floor(delta / v)
                    const expires = (n + 1) * v + timestamp
                    const plural = n > 1 ? "s" : ""
                    return { current: `${n} ${name}${plural} ago`, expires }
                }
            }
        }
        return { current: "Just now", expires: timestamp + 1000 }
    }
}

export const endOfDayView: TimeView<number> = (now) => {
    const eod = endOfDay(now)
    return {
        current: eod,
        expires: eod,
    }
}
