import { Actor } from "../actor"
import { ETagMismatchError, IStorage } from "../storage/interface"

export interface IIntegrator {
    integrate(fileId: string, file: Uint8Array, priority: number): Promise<void>
}

export class SyncManager extends Actor {
    readonly storage: IStorage
    #lastSeenEtag: string | null = null
    #lastIntegratedEtag: string | null = null
    #fileId: string
    #integrator: IIntegrator
    #pendingData: Uint8Array | null = null
    #downloadTriggered = false
    #lastError: unknown = null
    #priority: number

    constructor(storage: IStorage, fileId: string, integrator: IIntegrator, priority: number) {
        super()
        this.#fileId = fileId
        this.storage = storage
        this.#integrator = integrator
        this.#priority = priority
        this.triggerDownload()
    }
    dispose(): void {
        super.dispose()
        this.storage.dispose()
    }
    get lastError() {
        return this.#lastError
    }
    get priority() {
        return this.#priority
    }
    onDataChanged(data: Uint8Array) {
        this.#pendingData = data
        this._post(() => this.#tryUpload())
    }
    triggerDownload() {
        if (!this.#downloadTriggered) {
            this.#downloadTriggered = true
            this._post(() => this.#tryDownload())
        }
    }
    async #tryUpload() {
        if (this.#lastSeenEtag !== this.#lastIntegratedEtag) {
            this.triggerDownload()
            return
        }
        if (this.#pendingData === null) {
            return
        }
        try {
            this.#lastSeenEtag = await this.storage.uploadFile(this.#fileId, this.#lastIntegratedEtag, this.#pendingData)
            this.#pendingData = null
            this.#lastError = null
            this.#lastIntegratedEtag = this.#lastSeenEtag
        } catch (err) {
            if (err instanceof ETagMismatchError) {
                this.triggerDownload()
            } else {
                this.#lastError = err
            }
        }
    }
    async #tryDownload() {
        try {
            const result = await this.storage.downloadFile(this.#fileId)
            if (result) {
                this.#lastSeenEtag = result.etag
                await this.#integrator.integrate(this.#fileId, result.data, this.#priority)
                this.#lastIntegratedEtag = result.etag
            } else {
                this.#lastSeenEtag = null
                this.#lastIntegratedEtag = null
            }
            this.#lastError = null
        } catch (err) {
            this.#lastError = err
        } finally {
            this.#downloadTriggered = false
        }
    }
}