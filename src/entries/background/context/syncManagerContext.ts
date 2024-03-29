import { abstractMethod, Decorated, mixin } from "~/entries/shared/mixin"
import { Actor } from "../actor"
import { IIntegrator, SyncManager } from "../sync/manager"
import {
    PrivilegedSyncState,
    StorageAddress,
    StorageSyncState,
} from "~/entries/shared/privileged/state"
import { objectKey } from "~/entries/shared"
import { STORAGE_MANAGER } from "../storage/connection"
import { IStorage } from "../storage/interface"

export interface ISyncManagerContext extends IIntegrator {
    _getSyncState(fileId: string): PrivilegedSyncState
    _updateSyncManagers(
        fileId: string,
        addresses: readonly StorageAddress[]
    ): void
    _saveChanges(
        fileId: string,
        data: Uint8Array,
        specificAddress?: StorageAddress
    ): void
    _refetchData(fileId: string): void

    // Must be implemented
    _syncStateChanged(fileId: string): void
    // Returns true if the data was successfully provided
    _dataRequested(fileId: string, address: StorageAddress): Promise<boolean>
}

type SyncManagerState = {
    address: StorageAddress
    manager?: SyncManager
}

type SyncManagers = Map<string, SyncManagerState>

function addressKey(priority: number, address: StorageAddress): string {
    return `[${priority}] ${objectKey(address)}`
}

// Handles loading and updating the setup key
export const SyncManagerContext = mixin<ISyncManagerContext, Actor>((Base) =>
    Decorated(
        class SyncManagerContext extends Base implements ISyncManagerContext {
            #syncManagers: Map<string, SyncManagers> = new Map()

            #triggerSyncStateChanged(fileId: string) {
                void this._post(`_syncStateChanged(${fileId})`, async () => {
                    this._syncStateChanged(fileId)
                })
            }

            _updateSyncManagers(
                fileId: string,
                addresses: readonly StorageAddress[]
            ) {
                this.#updateFile(fileId, (oldMap) => {
                    const newMap: SyncManagers = new Map()
                    for (const [i, address] of addresses.entries()) {
                        const key = addressKey(i, address)
                        const state = oldMap.get(key)
                        if (state !== undefined) {
                            oldMap.delete(key)
                            newMap.set(key, state)
                        } else {
                            newMap.set(key, { address })
                            this.#setupSyncManager(fileId, address, i)
                        }
                    }
                    for (const state of oldMap.values()) {
                        state.manager?.dispose()
                    }
                    if (oldMap.size > 0) {
                        this.#triggerSyncStateChanged(fileId)
                    }
                    return newMap
                })
            }

            _saveChanges(
                fileId: string,
                data: Uint8Array,
                specificAddress?: StorageAddress
            ) {
                const specificAddressKey =
                    specificAddress && objectKey(specificAddress)
                const map = this.#syncManagers.get(fileId)
                if (map) {
                    for (const state of map.values()) {
                        if (
                            specificAddressKey === undefined ||
                            specificAddressKey === objectKey(state.address)
                        ) {
                            state.manager?.onDataChanged(data)
                        }
                    }
                }
            }

            _refetchData(fileId: string) {
                const map = this.#syncManagers.get(fileId)
                if (map) {
                    for (const state of map.values()) {
                        state.manager?.triggerDownload()
                    }
                }
            }

            #updateFile(
                fileId: string,
                f: (syncManagers: SyncManagers) => SyncManagers
            ) {
                const map = f(this.#syncManagers.get(fileId) ?? new Map())
                if (map.size === 0) {
                    this.#syncManagers.delete(fileId)
                } else {
                    this.#syncManagers.set(fileId, map)
                }
            }

            #setupSyncManager(
                fileId: string,
                address: StorageAddress,
                priority: number
            ) {
                void this._post(
                    `#setupSyncManager(${fileId}, ${address}, ${priority})`,
                    async () => {
                        const key = addressKey(priority, address)
                        let storage: IStorage | undefined = undefined
                        try {
                            storage = await STORAGE_MANAGER.open(address)
                        } finally {
                            this.#updateFile(fileId, (map) => {
                                const state = map.get(key)
                                if (state && !state.manager) {
                                    if (storage === undefined) {
                                        map.delete(key)
                                    } else {
                                        state.manager = new SyncManager(
                                            storage,
                                            fileId,
                                            this,
                                            priority
                                        )
                                        state.manager.addEventListener(
                                            "busychanged",
                                            () => {
                                                this.#triggerSyncStateChanged(
                                                    fileId
                                                )
                                            }
                                        )
                                    }
                                } else {
                                    storage?.dispose()
                                    storage = undefined
                                }
                                return map
                            })
                            this._syncStateChanged(fileId)
                            if (storage) {
                                await this._dataRequested(fileId, address)
                            }
                        }
                    }
                )
            }

            _getSyncState(fileId: string): PrivilegedSyncState {
                const map = this.#syncManagers.get(fileId)
                const syncState: {
                    [storageAddress: string]: StorageSyncState
                } = {}
                for (const state of map?.values() ?? []) {
                    const k = objectKey(state.address)
                    syncState[k] = {
                        address: state.address,
                        inProgress: state.manager ? state.manager.busy : true,
                        lastError: state.manager?.lastError?.toString(),
                    }
                }
                return syncState
            }

            _syncStateChanged(_fileId: string) {}
            async _dataRequested(
                _fileId: string,
                _address: StorageAddress
            ): Promise<boolean> {
                return false
            }
            async integrate(
                _fileId: string,
                _file: Uint8Array,
                _priority: number
            ): Promise<boolean> {
                return false
            }

            static _decorators = [
                abstractMethod("_syncStateChanged"),
                abstractMethod("integrate"),
                abstractMethod("_dataRequested"),
            ] as const
        }
    )
)
