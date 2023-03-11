import { StorageAddress } from "~/entries/shared/privileged/state"
import { IDisposable } from "../../shared/mixins/disposable"

export type DataAndEtag = {
    data: Uint8Array
    etag: string
}

export class ETagMismatchError extends Error {}

export interface IStorage extends IDisposable {
    readonly address: StorageAddress
    downloadFile(fileId: string): Promise<DataAndEtag | undefined>
    uploadFile(
        fileId: string,
        expectedEtag: string | null,
        data: Uint8Array
    ): Promise<string>
    deleteFile(fileId: string, expectedEtag: string): Promise<void>
}
