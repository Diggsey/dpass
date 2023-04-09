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

    constructor(
        storage: IStorage,
        fileId: string,
        integrator: IIntegrator,
        priority: number
    ) {
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
        void this._post("tryUpload()", this.#tryUpload)
    }
    triggerDownload() {
        if (!this.#downloadTriggered) {
            this.#downloadTriggered = true
            void this._post("tryDownload()", this.#tryDownload)
        }
    }
    #tryUpload = async () => {
        if (this.#lastSeenEtag !== this.#lastIntegratedEtag) {
            this.triggerDownload()
            return
        }
        const dataToUpload = this.#pendingData
        if (dataToUpload === null) {
            return
        }

        try {
            this.#lastSeenEtag = await this.storage.uploadFile(
                this.#fileId,
                this.#lastIntegratedEtag,
                dataToUpload
            )
            if (this.#pendingData === dataToUpload) {
                this.#pendingData = null
            }

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
    #tryDownload = async () => {
        this.#downloadTriggered = false
        try {
            const result = await this.storage.downloadFile(this.#fileId)
            if (result) {
                this.#lastSeenEtag = result.etag
                await this.#integrator.integrate(
                    this.#fileId,
                    result.data,
                    this.#priority
                )
                this.#lastIntegratedEtag = result.etag
            } else {
                this.#lastSeenEtag = null
                this.#lastIntegratedEtag = null
            }
            this.#lastError = null
        } catch (err) {
            this.#lastError = err
        }
    }
}
