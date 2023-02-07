export type MergeableItem<T> = {
    uuid: string,
    creationTimestamp: number,
    updateTimestamp: number,
    payload: T,
}

export type MergeableFile<T> = {
    uuid: string,
    items: MergeableItem<T | null>[],
}

class MergeError extends Error { }

class MergeContext<T> {
    #latestTimestamps: Map<string, number>
    #uuids: Set<string>
    #allItems: MergeableItem<T | null>[]

    constructor() {
        this.#latestTimestamps = new Map()
        this.#uuids = new Set()
        this.#allItems = []
    }
    #addItem(item: MergeableItem<T | null>) {
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

export function extractItems<T, U extends T>(a: MergeableFile<T>, f: (item: MergeableItem<T>) => item is MergeableItem<U>): MergeableItem<U>[] {
    const g = (item: MergeableItem<T | null>): item is MergeableItem<U> => {
        if (item.payload !== null) {
            return f({ ...item, payload: item.payload })
        } else {
            return false
        }
    }
    return a.items.filter(g)
}

export function itemPatcher<T>(f: (payload: T | null, uuid: string) => T | null): (file: MergeableFile<T>) => MergeableFile<T> {
    const updateTimestamp = Date.now()
    return file => ({
        ...file,
        items: file.items.map(item => {
            const payload = f(item.payload, item.uuid)
            if (payload !== item.payload) {
                item = {
                    ...item,
                    payload,
                    updateTimestamp,
                }
            }
            return item
        }),
    })
}

export function itemCreator<T, U extends T>(payload: U, uuid?: string): (file: MergeableFile<T>) => MergeableFile<T> {
    const timestamp = Date.now()
    return file => ({
        ...file,
        items: [...file.items, {
            uuid: uuid || crypto.randomUUID(),
            creationTimestamp: timestamp,
            updateTimestamp: timestamp,
            payload,
        }],
    })
}

function computeUpdateTimestamps<T>(a: MergeableFile<T>): string[] {
    return a.items.map(item => `${item.uuid} ${item.updateTimestamp}`).sort()
}

export function areFilesEqual<T>(a: MergeableFile<T> | null, b: MergeableFile<T> | null): boolean {
    if (a === null || b === null) {
        return a === null && b === null
    }
    if (a.uuid !== b.uuid) {
        return false
    }
    const at = computeUpdateTimestamps(a)
    const bt = computeUpdateTimestamps(b)

    if (at.length !== bt.length) {
        return false
    }
    for (let i = 0; i < at.length; ++i) {
        if (at[i] !== bt[i]) {
            return false
        }
    }
    return true
}

export function newFile<T>(): MergeableFile<T> {
    return {
        uuid: crypto.randomUUID(),
        items: [],
    }
}