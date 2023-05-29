import { objectKey } from "~/entries/shared"
import {
    ConnectionInfo,
    StorageAddress,
} from "~/entries/shared/privileged/state"
import { Actor } from "../actor"
import { Rc, WeakRc } from "../rc"
import { GDriveStorage } from "./gdrive"
import { IStorage } from "./interface"
import { LocalStorage } from "./local"
import { SharedStorage } from "./shared"

export function storageConnection(addr: StorageAddress): ConnectionInfo {
    switch (addr.id) {
        case "local":
            return { id: "none" }
        case "gdrive":
            return { id: "oauth", serverId: "com.google", userId: addr.userId }
    }
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
        const storageKey = objectKey(address)
        return this._post(`open(${storageKey})`, async () => {
            let storage = this.#storageMap
                .get(storageKey)
                ?.upgrade(SharedStorage)
            if (!storage) {
                let innerStorage
                switch (address.id) {
                    case "local":
                        innerStorage = await LocalStorage.open(address)
                        break
                    case "gdrive":
                        innerStorage = await GDriveStorage.open(address)
                        break
                }
                storage = Rc.create(SharedStorage, innerStorage)

                this.#storageMap.set(storageKey, storage.downgrade())
            }
            return storage
        })
    }
}

export const STORAGE_MANAGER = new StorageManager()
