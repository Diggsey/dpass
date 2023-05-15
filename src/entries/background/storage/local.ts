import { LocalStorageAddress } from "~/entries/shared/privileged/state"
import { Disposable } from "../../shared/mixins/disposable"
import { DataAndEtag, ETagMismatchError, IStorage } from "./interface"
import { Traceable } from "~/entries/shared/mixins/traceable"

const OBJECT_STORE_NAME = "blobs"

type TransactionResult<T> =
    | {
          success: true
          value: T
      }
    | {
          success: false
          error: unknown
      }

export class LocalStorage
    extends Traceable(Disposable(EventTarget))
    implements IStorage
{
    readonly address: LocalStorageAddress
    #db: IDBDatabase

    constructor(db: IDBDatabase, address: LocalStorageAddress) {
        super()
        this.#db = db
        this.address = address
    }
    dispose(): void {
        if (!this.disposed) {
            this.#db.close()
        }
        super.dispose()
    }
    static open(address: LocalStorageAddress): Promise<LocalStorage> {
        return new Promise((resolve, reject) => {
            const conn = indexedDB.open(`dpass/${address.folderName}`, 1)
            conn.onupgradeneeded = (e) => {
                if (e.newVersion === null || e.newVersion === e.oldVersion) {
                    return
                }
                const db = conn.result

                switch (e.oldVersion) {
                    case 0:
                        db.createObjectStore(OBJECT_STORE_NAME)
                    // falls through
                    default:
                        if (e.newVersion > 1) {
                            throw new Error("Unknown database version")
                        }
                }
            }
            conn.onsuccess = () =>
                resolve(new LocalStorage(conn.result, address))
            conn.onerror = reject
        })
    }
    performTransaction<T>(
        mode: "readonly" | "readwrite",
        f: (objectStore: IDBObjectStore) => Promise<T>
    ): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.trace`enter performTransaction(${mode})`
            const tx = this.#db.transaction(OBJECT_STORE_NAME, mode)

            let transactionActive = true
            let transactionResult: TransactionResult<T> = {
                success: false,
                error: new Error("Transaction interrupted by debugger"),
            }

            const complete = () => {
                transactionActive = false
                if (transactionResult.success) {
                    resolve(transactionResult.value)
                } else {
                    console.error(transactionResult.error)
                    reject(transactionResult.error)
                }
            }

            tx.onabort = () => {
                this.trace`leave performTransaction(abort)`
                complete()
            }
            tx.oncomplete = () => {
                this.trace`leave performTransaction(commit)`
                complete()
            }

            const objectStore = tx.objectStore(OBJECT_STORE_NAME)
            f(objectStore).then(
                (value) => {
                    transactionResult = { success: true, value }
                    tx.commit()
                },
                (error) => {
                    const isTransactionInactiveError =
                        error instanceof DOMException &&
                        error.name === "TransactionInactiveError"
                    if (transactionActive && !isTransactionInactiveError) {
                        transactionResult = { success: false, error }
                        this.trace`Aborting transaction...`
                        tx.abort()
                    }
                }
            )
        })
    }
    static downloadFileInner(
        objectStore: IDBObjectStore,
        fileId: string
    ): Promise<DataAndEtag | undefined> {
        return new Promise((resolve, reject) => {
            const req = objectStore.get(fileId)
            req.onerror = reject
            req.onsuccess = () => {
                resolve(req.result)
            }
        })
    }
    static uploadFileInner(
        objectStore: IDBObjectStore,
        fileId: string,
        data: DataAndEtag
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = objectStore.put(data, fileId)
            req.onerror = reject
            req.onsuccess = () => resolve()
        })
    }
    static deleteFileInner(
        objectStore: IDBObjectStore,
        fileId: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = objectStore.delete(fileId)
            req.onerror = reject
            req.onsuccess = () => resolve()
        })
    }
    downloadFile(fileId: string): Promise<DataAndEtag | undefined> {
        return this.performTransaction("readonly", (objectStore) =>
            LocalStorage.downloadFileInner(objectStore, fileId)
        )
    }
    uploadFile(
        fileId: string,
        expectedEtag: string | null,
        data: Uint8Array
    ): Promise<string> {
        return this.performTransaction("readwrite", async (objectStore) => {
            const fileAndEtag = await LocalStorage.downloadFileInner(
                objectStore,
                fileId
            )
            if (fileAndEtag?.etag != expectedEtag) {
                throw new ETagMismatchError()
            }
            const etag = Date.now().toString()
            await LocalStorage.uploadFileInner(objectStore, fileId, {
                etag,
                data,
            })
            return etag
        })
    }
    deleteFile(fileId: string, expectedEtag: string | null): Promise<void> {
        return this.performTransaction("readwrite", async (objectStore) => {
            if (expectedEtag !== null) {
                const fileAndEtag = await LocalStorage.downloadFileInner(
                    objectStore,
                    fileId
                )
                if (fileAndEtag?.etag != expectedEtag) {
                    throw new ETagMismatchError()
                }
            }
            await LocalStorage.deleteFileInner(objectStore, fileId)
        })
    }
}
