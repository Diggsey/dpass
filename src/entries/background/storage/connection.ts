import { ConnectionInfo, StorageAddress } from "~/entries/shared/privileged/state"
import { Actor } from "../actor"
import { Rc, WeakRc } from "../rc"
import { IStorage } from "./interface"
import { LocalStorage } from "./local"
import { SharedStorage } from "./shared"

export function storageConnection(addr: StorageAddress): ConnectionInfo {
    switch (addr.id) {
        case "local": return { id: "none" }
        case "gdrive": return { id: "oauth", serverId: "google", userId: addr.userId }
    }
}

interface ObjectWithId extends Object {
    id: string
}

export function objectKey({ id, ...params }: ObjectWithId): string {
    const paramsArray = Object.entries(params)
    paramsArray.sort((a, b) => a[0].localeCompare(b[0]))
    const paramStr = paramsArray.map(([k, v]) => `${k}=${v}`).join(",")
    return `${id}:${paramStr}`
}

class StorageManager extends Actor {
    #storageMap: Map<string, WeakRc<IStorage>>

    constructor() {
        super()
        this.#storageMap = new Map()
    }

    #gc() {
        for (const [k, v] of this.#storageMap.entries()) {
            if (v.count == 0) {
                this.#storageMap.delete(k)
            }
        }
    }

    open(address: StorageAddress): Promise<IStorage> {
        this.#gc()
        return this._post(async () => {
            const storageKey = objectKey(address)
            let storage = this.#storageMap.get(storageKey)?.upgrade(SharedStorage)
            if (!storage) {
                let innerStorage
                switch (address.id) {
                    case "local":
                        innerStorage = await LocalStorage.open(address)
                        break
                    case "gdrive":
                        throw new Error("Not supported")
                }
                storage = Rc.create(SharedStorage, innerStorage)

                this.#storageMap.set(storageKey, storage.downgrade())
            }
            return storage
        })

    }
}

export const STORAGE_MANAGER = new StorageManager()
