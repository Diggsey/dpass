import { DataAndEtag, ETagMismatchError, IStorage } from "./interface"

const OBJECT_STORE_NAME = "blobs"

export class LocalStorage implements IStorage {
    db: IDBDatabase
    constructor(db: IDBDatabase) {
        this.db = db
    }
    static open(): Promise<LocalStorage> {
        return new Promise((resolve, reject) => {
            const conn = indexedDB.open("dpass_store", 1)
            conn.onupgradeneeded = (e) => {
                if (e.newVersion === null || e.newVersion === e.oldVersion) { return }
                const db = conn.result;

                switch (e.oldVersion) {
                    case 0:
                        db.createObjectStore(OBJECT_STORE_NAME);
                    // Intentional fall-through
                    default:
                        if (e.newVersion > 1) {
                            throw new Error("Unknown database version")
                        }
                }
            }
            conn.onsuccess = () => resolve(new LocalStorage(conn.result))
            conn.onerror = reject
        })
    }
    performTransaction<T>(mode: "readonly" | "readwrite", f: (objectStore: IDBObjectStore) => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const tx = this.db.transaction(OBJECT_STORE_NAME, mode)
            let successFn: (() => void) | null = null
            let errorValue: any = null
            tx.onabort = () => reject(errorValue)
            tx.oncomplete = () => successFn && successFn()

            const objectStore = tx.objectStore(OBJECT_STORE_NAME)
            f(objectStore).then(res => {
                successFn = () => resolve(res)
                tx.commit()
            }, err => {
                errorValue = err
                tx.abort()
            })
        })
    }
    static downloadFileInner(objectStore: IDBObjectStore, fileId: string): Promise<DataAndEtag | undefined> {
        return new Promise((resolve, reject) => {
            const req = objectStore.get(fileId)
            req.onerror = reject
            req.onsuccess = () => {
                resolve(req.result)
            }
        })
    }
    static uploadFileInner(objectStore: IDBObjectStore, fileId: string, data: ArrayBuffer): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = objectStore.put(data, fileId)
            req.onerror = reject
            req.onsuccess = () => resolve()
        })
    }
    static deleteFileInner(objectStore: IDBObjectStore, fileId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const req = objectStore.delete(fileId)
            req.onerror = reject
            req.onsuccess = () => resolve()
        })
    }
    downloadFile(fileId: string): Promise<DataAndEtag | undefined> {
        return this.performTransaction("readonly", objectStore => LocalStorage.downloadFileInner(objectStore, fileId))
    }
    uploadFile(fileId: string, expectedEtag: string | null, data: ArrayBuffer): Promise<void> {
        return this.performTransaction("readwrite", async objectStore => {
            const fileAndEtag = await LocalStorage.downloadFileInner(objectStore, fileId)
            if (fileAndEtag?.etag != expectedEtag) {
                throw new ETagMismatchError()
            }
            await LocalStorage.uploadFileInner(objectStore, fileId, data)
        })
    }
    deleteFile(fileId: string, expectedEtag: string): Promise<void> {
        return this.performTransaction("readwrite", async objectStore => {
            const fileAndEtag = await LocalStorage.downloadFileInner(objectStore, fileId)
            if (fileAndEtag?.etag != expectedEtag) {
                throw new ETagMismatchError()
            }
            await LocalStorage.deleteFileInner(objectStore, fileId)
        })
    }
}