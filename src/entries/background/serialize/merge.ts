export type MergeableItem<T> = {
    uuid: string,
    creationTimestamp: number,
    updateTimestamp: number,
    payload: T | null,
}

export type MergeableFile<T> = {
    uuid: string,
    items: MergeableItem<T>[],
}

class MergeError extends Error { }

class MergeContext<T> {
    #latestTimestamps: Map<string, number>
    #uuids: Set<string>
    #allItems: MergeableItem<T>[]

    constructor() {
        this.#latestTimestamps = new Map()
        this.#uuids = new Set()
        this.#allItems = []
    }
    #addItem(item: MergeableItem<T>) {
        const prevTimestamp = this.#latestTimestamps.get(item.uuid)
        if (prevTimestamp === undefined || prevTimestamp < item.updateTimestamp) {
            this.#latestTimestamps.set(item.uuid, item.updateTimestamp)
        }
        this.#allItems.push(item)
    }
    add(...files: MergeableFile<T>[]) {
        for (const file of files) {
            this.#uuids.add(file.uuid)
            for (const item of file.items) {
                this.#addItem(item)
            }
        }
    }
    merge(): MergeableFile<T> {
        if (this.#uuids.size > 1) {
            throw new MergeError("Attempted to merge files with different identities")
        }
        let uuid = null
        for (const x of this.#uuids) {
            uuid = x;
        }
        if (uuid === null) {
            throw new MergeError("No input files")
        }
        const items = this.#allItems.filter(item => {
            return this.#latestTimestamps.get(item.uuid) === item.updateTimestamp
        })
        return { uuid, items }
    }
}

export function mergeFiles<T>(a: MergeableFile<T>, b: MergeableFile<T>): MergeableFile<T> {
    const ctx = new MergeContext<T>()
    ctx.add(a, b)
    return ctx.merge()
}